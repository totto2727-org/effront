import type { ApplicationDefinition } from "@effront/core";
import type { HttpApplicationEffect } from "@effront/core/http";
import { CloudflareEnvironment } from "alchemy/Cloudflare";
import { RuntimeContext } from "alchemy/RuntimeContext";
import { Context, Deferred, Effect, Exit, Fiber, Layer, Option, Scope } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { describe, expect, expectTypeOf, it, vi } from "vite-plus/test";

import * as deployment from "./deployment";
import { applicationHttpEffect, makeApplicationHttpEffect } from "./runtime";
import * as configuredDeployment from "./application";
import { makeApplicationHttpEffect as makeConfiguredApplicationHttpEffect } from "./application-runtime";

class Capability extends Context.Service<Capability, string>()("effront/test/alchemy/Capability") {}
class Selection extends Context.Service<Selection, string>()("effront/test/alchemy/Selection") {}

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
  it("infers a failure-only source without unknown dependencies", async () => {
    const failure = { _tag: "SourceFailure" } as const;
    const handler = applicationHttpEffect(Effect.fail(failure));
    const construction = makeApplicationHttpEffect(Effect.fail(failure));
    expectTypeOf<Effect.Services<typeof construction>>().toEqualTypeOf<never>();
    expectTypeOf<Effect.Error<typeof construction>>().toEqualTypeOf<never>();
    expectTypeOf<Effect.Error<typeof handler>>().toEqualTypeOf<
      Effect.Error<HttpApplicationEffect<never, never>> | typeof failure
    >();
    expectTypeOf<Effect.Services<typeof handler>>().toEqualTypeOf<
      Effect.Services<HttpApplicationEffect<never, never>>
    >();
    const constructed = await Effect.runPromise(construction);
    expect(
      await Effect.runPromise(
        Effect.exit(
          Effect.scoped(constructed).pipe(
            Effect.provideService(HttpServerRequest.HttpServerRequest, request("/failure")),
          ),
        ),
      ),
    ).toEqual(Exit.fail(failure));
  });
  it("keeps the deployment and RSC APIs type-identical and construction-safe", async () => {
    expectTypeOf(deployment.makeApplicationHttpEffect).toEqualTypeOf(makeApplicationHttpEffect);
    expectTypeOf(deployment.applicationHttpEffect).toEqualTypeOf(applicationHttpEffect);
    expectTypeOf(configuredDeployment.makeApplicationHttpEffect).toEqualTypeOf(
      makeConfiguredApplicationHttpEffect,
    );
    const handler = await Effect.runPromise(
      deployment
        .makeApplicationHttpEffect(Effect.succeed(application))
        .pipe(Effect.provideService(Capability, "constructed")),
    );
    expect(Effect.isEffect(handler)).toBe(true);
  });

  it("captures configured application capabilities without loading the application during construction", async () => {
    type ApplicationFailure = { readonly _tag: "ApplicationFailure" };
    type RouteFailure = { readonly _tag: "RouteFailure" };
    type Definition = ApplicationDefinition<
      Capability,
      ApplicationFailure,
      | HttpRouter.Request.From<"Requires", Capability>
      | HttpRouter.Request.From<"GlobalRequires", RuntimeContext>
      | HttpRouter.Request.From<"Error", RouteFailure>
    >;
    const construction = makeConfiguredApplicationHttpEffect<Definition>();
    expectTypeOf<Effect.Services<typeof construction>>().toEqualTypeOf<Capability>();
    const handler = await Effect.runPromise(
      construction.pipe(Effect.provideService(Capability, "constructed")),
    );
    expectTypeOf<Effect.Services<typeof handler>>().toEqualTypeOf<
      RuntimeContext | Scope.Scope | HttpServerRequest.HttpServerRequest
    >();
    expectTypeOf<
      Extract<Effect.Error<typeof handler>, ApplicationFailure | RouteFailure>
    >().toEqualTypeOf<ApplicationFailure | RouteFailure>();
    expect(handler).toBeDefined();
  });

  it("reports a missing Vite integration only when the configured handler executes", async () => {
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

  it("does not erase missing capabilities or accept non-application types", () => {
    const check = () => {
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

  it("normalizes native router requirement and error markers before construction capture", async () => {
    type RouteFailure = { readonly _tag: "RouteFailure" };
    type GlobalFailure = { readonly _tag: "GlobalFailure" };
    type Requirements =
      | HttpRouter.Request.From<"Requires", Capability>
      | HttpRouter.Request.From<"GlobalRequires", RuntimeContext>
      | HttpRouter.Request.From<"Error", RouteFailure>
      | HttpRouter.Request.From<"GlobalError", GlobalFailure>;
    const markedApplication = {} as ApplicationDefinition<never, never, Requirements>;
    const construction = makeApplicationHttpEffect(Effect.succeed(markedApplication));
    expectTypeOf<Effect.Services<typeof construction>>().toEqualTypeOf<Capability>();
    const handler = await Effect.runPromise(
      construction.pipe(Effect.provideService(Capability, "constructed")),
    );
    expectTypeOf<Effect.Services<typeof handler>>().toEqualTypeOf<
      RuntimeContext | Scope.Scope | HttpServerRequest.HttpServerRequest
    >();
    expectTypeOf<
      Extract<Effect.Error<typeof handler>, RouteFailure | GlobalFailure>
    >().toEqualTypeOf<RouteFailure | GlobalFailure>();
  });

  it("captures constructed capabilities without importing the application or requiring runtime services", async () => {
    const load = vi.fn(() => application);
    const handler = await Effect.runPromise(
      makeApplicationHttpEffect(Effect.sync(load)).pipe(
        Effect.provideService(Capability, "constructed"),
      ),
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
    expect(await HttpServerResponse.toWeb(response).text()).toBe("constructed:request:/lazy");
  });

  it("uses live request scope and runtime context instead of closed construction services", async () => {
    let constructionScope: Scope.Scope | undefined;
    const handler = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          constructionScope = yield* Effect.scope;
          return yield* makeApplicationHttpEffect(Effect.succeed(application));
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
      expect(await HttpServerResponse.toWeb(response).text()).toBe(`captured:${id}:/${id}`);
      expect(scopes.at(-1)).not.toBe(constructionScope);
      expect(finalized).toContain(id);
      expect(memoMaps.at(-1)).toEqual(Option.none());
      expect(metadataPresent.at(-1)).toBe(false);
    }
    expect(scopes.at(-1)).not.toBe(scopes.at(-2));
    expect(finalized).not.toContain("stale");
  });

  it("lets live capabilities override construction capabilities", async () => {
    const handler = await Effect.runPromise(
      makeApplicationHttpEffect(Effect.succeed(application)).pipe(
        Effect.provideService(Capability, "captured"),
      ),
    );
    const response = await Effect.runPromise(
      Effect.scoped(
        handler.pipe(
          Effect.provideService(Capability, "live"),
          Effect.provideService(RuntimeContext, runtime("current")),
          Effect.provideService(HttpServerRequest.HttpServerRequest, request("/override")),
        ),
      ),
    );
    expect(await HttpServerResponse.toWeb(response).text()).toBe("live:current:/override");
  });

  it("keeps dependencies native until the caller provides them", async () => {
    const handler = applicationHttpEffect(Effect.succeed(application));
    type Requirements = Effect.Services<HttpApplicationEffect<never, Capability | RuntimeContext>>;
    expectTypeOf<Effect.Services<typeof handler>>().toEqualTypeOf<Requirements>();
    const check = () => {
      const missingCapability = Effect.scoped(handler).pipe(
        Effect.provideService(RuntimeContext, runtime("current")),
        Effect.provideService(HttpServerRequest.HttpServerRequest, request("/missing")),
      );
      // @ts-expect-error The native HTTP Effect still requires Capability.
      void Effect.runPromise(missingCapability);
      // @ts-expect-error Application sources are Effects, not Promise callbacks.
      void applicationHttpEffect(async () => application);
      // @ts-expect-error Construction also accepts an Effect, not a callback.
      void makeApplicationHttpEffect(async () => application);
      // @ts-expect-error Use native Effect provisioning, not a context handoff option.
      void applicationHttpEffect(Effect.succeed(application), { context: Context.empty() });
    };
    expect(check).toBeTypeOf("function");
    const response = await Effect.runPromise(
      Effect.scoped(handler).pipe(
        Effect.provideService(Capability, "live"),
        Effect.provideService(RuntimeContext, runtime("current")),
        Effect.provideService(HttpServerRequest.HttpServerRequest, request("/native")),
      ),
    );
    expect(await HttpServerResponse.toWeb(response).text()).toBe("live:current:/native");
  });

  it("preserves source failures as typed failures in the request Effect", async () => {
    const failure = { _tag: "SelectionFailure" } as const;
    const source: Effect.Effect<typeof application, typeof failure> = Effect.fail(failure);
    const construction = makeApplicationHttpEffect(source);
    expectTypeOf<Effect.Error<typeof construction>>().toEqualTypeOf<never>();
    const handler = await Effect.runPromise(
      construction.pipe(Effect.provideService(Capability, "constructed")),
    );
    expectTypeOf<Extract<Effect.Error<typeof handler>, typeof failure>>().toEqualTypeOf<
      typeof failure
    >();
    const exit = await Effect.runPromise(
      Effect.scoped(handler).pipe(
        Effect.provideService(RuntimeContext, runtime("request")),
        Effect.provideService(HttpServerRequest.HttpServerRequest, request("/failure")),
        Effect.exit,
      ),
    );
    expect(exit).toEqual(Exit.fail(failure));
  });

  it("runs source Effects in each live request scope with captured and overridden dependencies", async () => {
    const selected: Array<string> = [];
    const sourceScopes: Array<Scope.Scope> = [];
    const released: Array<string> = [];
    const source = Effect.gen(function* () {
      const selection = yield* Selection;
      const current = yield* RuntimeContext;
      sourceScopes.push(yield* Effect.scope);
      selected.push(`${selection}:${current.id}`);
      yield* Effect.addFinalizer(() => Effect.sync(() => released.push(current.id)));
      return application;
    });
    const construction = makeApplicationHttpEffect(source);
    expectTypeOf<Effect.Services<typeof construction>>().toEqualTypeOf<Capability | Selection>();
    const handler = await Effect.runPromise(
      construction.pipe(
        Effect.provideService(Capability, "captured"),
        Effect.provideService(Selection, "constructed"),
      ),
    );
    expect(selected).toEqual([]);
    expectTypeOf<Effect.Services<typeof handler>>().toEqualTypeOf<
      RuntimeContext | Scope.Scope | HttpServerRequest.HttpServerRequest
    >();
    for (const id of ["first", "second"]) {
      const response = await Effect.runPromise(
        Effect.scoped(handler).pipe(
          Effect.provideService(Selection, id),
          Effect.provideService(RuntimeContext, runtime(id)),
          Effect.provideService(HttpServerRequest.HttpServerRequest, request(`/${id}`)),
        ),
      );
      expect(await HttpServerResponse.toWeb(response).text()).toBe(`captured:${id}:/${id}`);
      expect(sourceScopes.at(-1)).toBe(scopes.at(-1));
      expect(released).toContain(id);
    }
    expect(selected).toEqual(["first:first", "second:second"]);
    expect(sourceScopes[0]).not.toBe(sourceScopes[1]);
  });

  it("interrupts a pending source Effect and releases its request resources", async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const started = yield* Deferred.make<void>();
          const released = yield* Deferred.make<void>();
          const source: Effect.Effect<typeof application, never, Scope.Scope> = Effect.gen(
            function* () {
              yield* Effect.addFinalizer(() => Deferred.succeed(released, void 0));
              yield* Deferred.succeed(started, void 0);
              return yield* Effect.never;
            },
          );
          const handler = yield* makeApplicationHttpEffect(source).pipe(
            Effect.provideService(Capability, "constructed"),
          );
          const fiber = yield* Effect.forkChild(
            Effect.scoped(handler).pipe(
              Effect.provideService(RuntimeContext, runtime("cancelled")),
              Effect.provideService(HttpServerRequest.HttpServerRequest, request("/cancelled")),
            ),
          );
          yield* Deferred.await(started);
          yield* Fiber.interrupt(fiber);
          yield* Deferred.await(released);
        }),
      ),
    );
  });

  it("retains application capabilities in construction requirements", () => {
    const check = () => {
      // @ts-expect-error Construction requires Capability, but not host RuntimeContext.
      void Effect.runPromise(makeApplicationHttpEffect(Effect.succeed(application)));
    };
    expect(check).toBeTypeOf("function");
  });
});
