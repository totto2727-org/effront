import { live } from "@effect/vitest";
import type { ApplicationDefinition } from "@effront/core";
import type { HttpApplicationEffect } from "@effront/core/http";
import { CloudflareEnvironment } from "alchemy/Cloudflare";
import { RuntimeContext } from "alchemy/RuntimeContext";
import { Context, Effect, Layer, Option, Scope } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { describe, expect, expectTypeOf, test, vi } from "vite-plus/test";

import * as deployment from "./deployment.ts";
import { applicationHttpEffect, makeApplicationHttpEffect } from "./runtime.ts";
import * as configuredDeployment from "./application.ts";
import { makeApplicationHttpEffect as makeConfiguredApplicationHttpEffect } from "./application-runtime.ts";

class Capability extends Context.Service<Capability, string>()("effront/test/alchemy/Capability") {}

const scopes: Array<Scope.Scope> = [];
const finalized: Array<string> = [];
const memoMaps: Array<Option.Option<Layer.MemoMap>> = [];
const metadataPresent: Array<boolean> = [];

// This unit boundary isolates capability capture from the core renderer. Real
// Worker/RSC execution belongs to the local workerd acceptance fixture.
vi.mock("@effront/core/http", () => ({
  toHttpEffect: () =>
    Effect.gen(function* () {
      const capability = yield* Capability;
      const runtime = yield* RuntimeContext;
      const request = yield* HttpServerRequest.HttpServerRequest;
      scopes.push(yield* Effect.scope);
      memoMaps.push(yield* Effect.serviceOption(Layer.CurrentMemoMap));
      metadataPresent.push(Option.isSome(yield* Effect.serviceOption(CloudflareEnvironment)));
      yield* Effect.addFinalizer(() => Effect.sync(() => finalized.push(runtime.id)));
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
  live("keeps the deployment and RSC APIs type-identical and construction-safe", () =>
    Effect.gen(function* () {
      expectTypeOf(deployment.makeApplicationHttpEffect).toEqualTypeOf(makeApplicationHttpEffect);
      expectTypeOf(deployment.applicationHttpEffect).toEqualTypeOf(applicationHttpEffect);
      expectTypeOf(configuredDeployment.makeApplicationHttpEffect).toEqualTypeOf(
        makeConfiguredApplicationHttpEffect,
      );
      const handler = yield* deployment
        .makeApplicationHttpEffect(async () => application)
        .pipe(Effect.provideService(Capability, "constructed"));
      expect(Effect.isEffect(handler)).toBe(true);
    }),
  );

  live(
    "captures configured application capabilities without loading the application during construction",
    () =>
      Effect.gen(function* () {
        type ApplicationFailure = Readonly<{ _tag: "ApplicationFailure" }>;
        type RouteFailure = Readonly<{ _tag: "RouteFailure" }>;
        type Definition = ApplicationDefinition<
          Capability,
          ApplicationFailure,
          | HttpRouter.Request.From<"Requires", Capability>
          | HttpRouter.Request.From<"GlobalRequires", RuntimeContext>
          | HttpRouter.Request.From<"Error", RouteFailure>
        >;
        const construction = makeConfiguredApplicationHttpEffect<Definition>();
        expectTypeOf<Effect.Services<typeof construction>>().toEqualTypeOf<Capability>();
        const handler = yield* construction.pipe(Effect.provideService(Capability, "constructed"));
        expectTypeOf<Effect.Services<typeof handler>>().toEqualTypeOf<
          RuntimeContext | Scope.Scope | HttpServerRequest.HttpServerRequest
        >();
        expectTypeOf<
          Extract<Effect.Error<typeof handler>, ApplicationFailure | RouteFailure>
        >().toEqualTypeOf<ApplicationFailure | RouteFailure>();
        expect(handler).toBeDefined();
      }),
  );

  test("reports a missing Vite integration only when the configured handler executes", async () => {
    const handler = await Effect.runPromise(
      makeConfiguredApplicationHttpEffect<typeof application>().pipe(
        Effect.provideService(Capability, "constructed"),
      ),
    );
    await expect(
      Effect.runPromise(
        Effect.scoped(
          handler.pipe(
            Effect.provideService(RuntimeContext, runtime("request")),
            Effect.provideService(HttpServerRequest.HttpServerRequest, request("/configured")),
          ),
        ),
      ),
    ).rejects.toThrow(
      "Configured application loading requires effront() followed by effrontAlchemy()",
    );
  });

  test("does not erase missing capabilities or accept non-application types", () => {
    const check = (): void => {
      // @ts-expect-error The configured application still requires Capability.
      void Effect.runPromise(makeConfiguredApplicationHttpEffect<typeof application>());
      // @ts-expect-error A configured entry must be an Effront application definition.
      void makeConfiguredApplicationHttpEffect<string>();
      // @ts-expect-error Omitting the application type cannot erase unknown requirements.
      void Effect.runPromise(makeConfiguredApplicationHttpEffect());
      // @ts-expect-error The existing entry requires an explicit loader.
      void makeApplicationHttpEffect();
    };
    expect(check).toBeTypeOf("function");
  });

  live("normalizes native router requirement and error markers before construction capture", () =>
    Effect.gen(function* () {
      type RouteFailure = Readonly<{ _tag: "RouteFailure" }>;
      type GlobalFailure = Readonly<{ _tag: "GlobalFailure" }>;
      type Requirements =
        | HttpRouter.Request.From<"Requires", Capability>
        | HttpRouter.Request.From<"GlobalRequires", RuntimeContext>
        | HttpRouter.Request.From<"Error", RouteFailure>
        | HttpRouter.Request.From<"GlobalError", GlobalFailure>;
      const markedApplication = {} as ApplicationDefinition<never, never, Requirements>;
      const construction = makeApplicationHttpEffect(async () => markedApplication);
      expectTypeOf<Effect.Services<typeof construction>>().toEqualTypeOf<Capability>();
      const handler = yield* construction.pipe(Effect.provideService(Capability, "constructed"));
      expectTypeOf<Effect.Services<typeof handler>>().toEqualTypeOf<
        RuntimeContext | Scope.Scope | HttpServerRequest.HttpServerRequest
      >();
      expectTypeOf<
        Extract<Effect.Error<typeof handler>, RouteFailure | GlobalFailure>
      >().toEqualTypeOf<RouteFailure | GlobalFailure>();
    }),
  );

  test("captures constructed capabilities without importing the application or requiring runtime services", async () => {
    const load = vi.fn(async () => application);
    const handler = await Effect.runPromise(
      makeApplicationHttpEffect(load).pipe(Effect.provideService(Capability, "constructed")),
    );
    expect(load).not.toHaveBeenCalled();

    const response = await Effect.runPromise(
      Effect.scoped(
        handler.pipe(
          Effect.provideService(RuntimeContext, runtime("request")),
          Effect.provideService(HttpServerRequest.HttpServerRequest, request("/lazy")),
        ),
      ),
    );
    expect(load).toHaveBeenCalledOnce();
    await expect(HttpServerResponse.toWeb(response).text()).resolves.toBe(
      "constructed:request:/lazy",
    );
  });

  test("uses live request scope and runtime context instead of closed construction services", async () => {
    let constructionScope: Scope.Scope | undefined;
    const handler = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          constructionScope = yield* Effect.scope;
          return yield* makeApplicationHttpEffect(async () => application);
        }).pipe(
          Effect.provideService(Capability, "captured"),
          Effect.provideService(RuntimeContext, runtime("stale")),
          Effect.provideService(Layer.CurrentMemoMap, Layer.makeMemoMapUnsafe()),
          Effect.provideService(
            CloudflareEnvironment,
            Effect.die("Construction metadata must never be restored into a request"),
          ),
          Effect.provideService(HttpServerRequest.HttpServerRequest, request("/stale")),
        ),
      ),
    );

    for (const id of ["first", "second"]) {
      const response = await Effect.runPromise(
        Effect.scoped(
          handler.pipe(
            Effect.provideService(RuntimeContext, runtime(id)),
            Effect.provideService(HttpServerRequest.HttpServerRequest, request(`/${id}`)),
          ),
        ),
      );
      await expect(HttpServerResponse.toWeb(response).text()).resolves.toBe(
        `captured:${id}:/${id}`,
      );
      expect(scopes.at(-1)).not.toBe(constructionScope);
      expect(finalized).toContain(id);
      expect(memoMaps.at(-1)).toStrictEqual(Option.none());
      expect(metadataPresent.at(-1)).toBe(false);
    }
    expect(scopes.at(-1)).not.toBe(scopes.at(-2));
    expect(finalized).not.toContain("stale");
  });

  test("lets live capabilities override explicitly captured capabilities", async () => {
    const handler = applicationHttpEffect(async () => application, {
      context: Context.make(Capability, "captured"),
    });
    const response = await Effect.runPromise(
      Effect.scoped(
        handler.pipe(
          Effect.provideService(Capability, "live"),
          Effect.provideService(RuntimeContext, runtime("current")),
          Effect.provideService(HttpServerRequest.HttpServerRequest, request("/override")),
        ),
      ),
    );
    await expect(HttpServerResponse.toWeb(response).text()).resolves.toBe("live:current:/override");
  });

  test("retains live capability requirements when a capture type has no supplied context", async () => {
    const load = async () => application;
    const omitted = applicationHttpEffect<never, never, Capability | RuntimeContext, Capability>(
      load,
    );
    const options: Readonly<{ context?: Context.Context<Capability> }> = {};
    const optional = applicationHttpEffect(load, options);
    type Requirements = Effect.Services<HttpApplicationEffect<never, Capability | RuntimeContext>>;
    expectTypeOf<Effect.Services<typeof omitted>>().toEqualTypeOf<Requirements>();
    expectTypeOf<Effect.Services<typeof optional>>().toEqualTypeOf<Requirements>();
    const check = (): void => {
      const missingCapability = Effect.scoped(omitted).pipe(
        Effect.provideService(RuntimeContext, runtime("current")),
        Effect.provideService(HttpServerRequest.HttpServerRequest, request("/missing")),
      );
      // @ts-expect-error A capture type alone does not supply Capability.
      void Effect.runPromise(missingCapability);
    };
    expect(check).toBeTypeOf("function");
    for (const handler of [omitted, optional]) {
      const response = await Effect.runPromise(
        Effect.scoped(handler).pipe(
          Effect.provideService(Capability, "live"),
          Effect.provideService(RuntimeContext, runtime("current")),
          Effect.provideService(HttpServerRequest.HttpServerRequest, request("/uncaptured")),
        ),
      );
      await expect(HttpServerResponse.toWeb(response).text()).resolves.toBe(
        "live:current:/uncaptured",
      );
    }
  });

  test("retains application capabilities in construction requirements", () => {
    const check = (): void => {
      // @ts-expect-error Construction requires Capability, but not host RuntimeContext.
      void Effect.runPromise(makeApplicationHttpEffect(async () => application));
    };
    expect(check).toBeTypeOf("function");
  });
});
