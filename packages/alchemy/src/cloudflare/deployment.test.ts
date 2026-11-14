import type { ApplicationDefinition } from "@effront/core";
import type { HttpApplicationEffect } from "@effront/core/http";
import { RuntimeContext } from "alchemy/RuntimeContext";
import { Context, Effect, Layer, Scope } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { describe, expect, expectTypeOf, it, vi } from "vite-plus/test";

import * as deployment from "./deployment";
import { applicationHttpEffect } from "./runtime";
import * as configuredDeployment from "./application";
import { applicationHttpEffect as configuredApplicationHttpEffect } from "./application-runtime";

class Capability extends Context.Service<Capability, string>()("effront/test/alchemy/Capability") {}

// Isolate adapter execution from rendering. Real Worker/RSC streaming is covered
// by the local workerd acceptance fixture.
vi.mock("@effront/core/http", () => ({
  toHttpEffect: () =>
    Effect.gen(function* () {
      const capability = yield* Capability;
      const runtime = yield* RuntimeContext;
      const request = yield* HttpServerRequest.HttpServerRequest;
      return HttpServerResponse.text(`${capability}:${runtime.id}:${request.url}`);
    }),
}));

const application = {} as ApplicationDefinition<never, never, Capability | RuntimeContext>;
const runtime = (id: string): RuntimeContext["Service"] => ({
  Type: "test",
  id,
  env: {},
  get: () => Effect.undefined,
  set: (key) => Effect.succeed(key),
});
const request = (path: string) =>
  HttpServerRequest.fromWeb(new Request(`https://example.test${path}`));

describe("Alchemy native application effects", () => {
  it("exposes type-identical deployment and RSC direct handlers without evaluating a loader", () => {
    expectTypeOf(deployment.applicationHttpEffect).toEqualTypeOf(applicationHttpEffect);
    expectTypeOf(configuredDeployment.applicationHttpEffect).toEqualTypeOf(
      configuredApplicationHttpEffect,
    );
    const load = vi.fn(async () => application);
    expect(Effect.isEffect(deployment.applicationHttpEffect(load))).toBe(true);
    expect(Effect.isEffect(applicationHttpEffect(load))).toBe(true);
    expect(Effect.isEffect(configuredDeployment.applicationHttpEffect<typeof application>())).toBe(
      true,
    );
    expect(Effect.isEffect(configuredApplicationHttpEffect<typeof application>())).toBe(true);
    expect(load).not.toHaveBeenCalled();
    expect(deployment).not.toHaveProperty("makeApplicationHttpEffect");
    expect(configuredDeployment).not.toHaveProperty("makeApplicationHttpEffect");
  });

  it("preserves configured application capabilities and native router failure markers", () => {
    type ApplicationFailure = { readonly _tag: "ApplicationFailure" };
    type RouteFailure = { readonly _tag: "RouteFailure" };
    type GlobalFailure = { readonly _tag: "GlobalFailure" };
    type Requirements =
      | HttpRouter.Request.From<"Requires", Capability>
      | HttpRouter.Request.From<"GlobalRequires", RuntimeContext>
      | HttpRouter.Request.From<"Error", RouteFailure>
      | HttpRouter.Request.From<"GlobalError", GlobalFailure>;
    type Definition = ApplicationDefinition<Capability, ApplicationFailure, Requirements>;
    const configured = configuredApplicationHttpEffect<Definition>();
    const marked = {} as Definition;
    const explicit = applicationHttpEffect(async () => marked);
    expectTypeOf(configured).toEqualTypeOf<
      HttpApplicationEffect<ApplicationFailure, Requirements>
    >();
    expectTypeOf(explicit).toEqualTypeOf(configured);
    expectTypeOf<Effect.Services<typeof explicit>>().toEqualTypeOf<
      Capability | RuntimeContext | Scope.Scope | HttpServerRequest.HttpServerRequest
    >();
    expectTypeOf<
      Extract<Effect.Error<typeof explicit>, ApplicationFailure | RouteFailure | GlobalFailure>
    >().toEqualTypeOf<ApplicationFailure | RouteFailure | GlobalFailure>();
    expect(Effect.isEffect(configured)).toBe(true);
  });

  it("keeps request scope and request services after providing configured application capabilities", () => {
    type Definition = ApplicationDefinition<Capability, never, Capability>;
    const handler = configuredApplicationHttpEffect<Definition>();
    const provided = handler.pipe(Effect.provideService(Capability, "provided"));
    expectTypeOf<Effect.Services<typeof handler>>().toEqualTypeOf<
      Capability | Scope.Scope | HttpServerRequest.HttpServerRequest
    >();
    expectTypeOf<Effect.Services<typeof provided>>().toEqualTypeOf<
      Scope.Scope | HttpServerRequest.HttpServerRequest
    >();
    const pure = configuredApplicationHttpEffect<ApplicationDefinition<never, never, never>>();
    expectTypeOf<Effect.Services<typeof pure>>().toEqualTypeOf<
      Scope.Scope | HttpServerRequest.HttpServerRequest
    >();
    expect(Effect.isEffect(provided)).toBe(true);
  });

  it("reports a missing Vite integration only when the configured handler executes", async () => {
    const handler = configuredApplicationHttpEffect<typeof application>();
    await expect(
      Effect.runPromise(
        Effect.scoped(
          handler.pipe(
            Effect.provideService(Capability, "live"),
            Effect.provideService(RuntimeContext, runtime("request")),
            Effect.provideService(HttpServerRequest.HttpServerRequest, request("/configured")),
          ),
        ),
      ),
    ).rejects.toThrow(
      "Configured application loading requires effront() followed by effrontAlchemy()",
    );
  });

  it("rejects missing capabilities, removed capture APIs, and invalid configured definitions", () => {
    const check = () => {
      // @ts-expect-error The configured handler still requires application and host services.
      void Effect.runPromise(configuredApplicationHttpEffect<typeof application>());
      // @ts-expect-error A configured entry must be an Effront application definition.
      void configuredApplicationHttpEffect<string>();
      // @ts-expect-error Omitting the application type cannot erase unknown requirements.
      void Effect.runPromise(configuredApplicationHttpEffect());
      // @ts-expect-error The explicit entry requires a loader.
      void applicationHttpEffect();
      // @ts-expect-error Context capture options have been removed.
      void applicationHttpEffect(async () => application, {
        context: Context.make(Capability, "old"),
      });
      // @ts-expect-error Construction effects have been removed.
      void deployment.makeApplicationHttpEffect;
      // @ts-expect-error Configured construction effects have been removed.
      void configuredDeployment.makeApplicationHttpEffect;
      const missing = Effect.scoped(applicationHttpEffect(async () => application)).pipe(
        Effect.provideService(RuntimeContext, runtime("request")),
        Effect.provideService(HttpServerRequest.HttpServerRequest, request("/missing")),
      );
      // @ts-expect-error Providing host services does not provide Capability.
      void Effect.runPromise(missing);
    };
    expect(check).toBeTypeOf("function");
  });

  it("loads lazily and reads independently provided services for each request", async () => {
    const load = vi.fn(async () => application);
    const handler = applicationHttpEffect(load);
    expect(load).not.toHaveBeenCalled();
    for (const id of ["first", "second"]) {
      const response = await Effect.runPromise(
        Effect.scoped(handler).pipe(
          Effect.provideService(Capability, id),
          Effect.provideService(RuntimeContext, runtime(id)),
          Effect.provideService(HttpServerRequest.HttpServerRequest, request(`/${id}`)),
        ),
      );
      expect(await HttpServerResponse.toWeb(response).text()).toBe(`${id}:${id}:/${id}`);
    }
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("releases native capability resources when lazy application loading fails", async () => {
    const release = vi.fn();
    const failure = new Error("Application loader failed");
    const load = vi.fn((): Promise<typeof application> => Promise.reject(failure));
    const capability = Layer.effect(
      Capability,
      Effect.gen(function* () {
        yield* Effect.addFinalizer(() => Effect.sync(() => release()));
        return "provided";
      }),
    );
    const handler = applicationHttpEffect(load).pipe(Effect.provide(capability));
    expect(load).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
    await expect(
      Effect.runPromise(
        Effect.scoped(handler).pipe(
          Effect.provideService(RuntimeContext, runtime("request")),
          Effect.provideService(HttpServerRequest.HttpServerRequest, request("/failure")),
        ),
      ),
    ).rejects.toThrow("Application loader failed");
    expect(load).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
  });

  it("acquires native capability layers in each live request scope and releases them afterwards", async () => {
    const scopes: Scope.Scope[] = [];
    const finalized: string[] = [];
    const handler = applicationHttpEffect(async () => application);
    for (const id of ["first", "second"]) {
      const capability = Layer.effect(
        Capability,
        Effect.gen(function* () {
          scopes.push(yield* Effect.scope);
          yield* Effect.addFinalizer(() => Effect.sync(() => finalized.push(id)));
          return id;
        }),
      );
      const response = await Effect.runPromise(
        Effect.scoped(
          handler.pipe(
            Effect.provide(capability),
            Effect.provideService(RuntimeContext, runtime(id)),
            Effect.provideService(HttpServerRequest.HttpServerRequest, request(`/${id}`)),
          ),
        ),
      );
      expect(await HttpServerResponse.toWeb(response).text()).toBe(`${id}:${id}:/${id}`);
      expect(finalized).toContain(id);
    }
    expect(scopes).toHaveLength(2);
    expect(scopes[0]).not.toBe(scopes[1]);
    expect(finalized).toEqual(["first", "second"]);
  });
});
