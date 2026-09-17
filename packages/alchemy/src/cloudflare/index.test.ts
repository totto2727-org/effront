import type { ApplicationDefinition } from "@effront/core";
import { CloudflareEnvironment } from "alchemy/Cloudflare";
import { RuntimeContext } from "alchemy/RuntimeContext";
import { Context, Effect, Layer, Option, Scope } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { describe, expect, expectTypeOf, it, vi } from "vite-plus/test";

import { applicationHttpEffect, makeApplicationHttpEffect } from "./index";

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
  it("normalizes native router requirement and error markers before construction capture", async () => {
    type RouteFailure = { readonly _tag: "RouteFailure" };
    type GlobalFailure = { readonly _tag: "GlobalFailure" };
    type Requirements =
      | HttpRouter.Request.From<"Requires", Capability>
      | HttpRouter.Request.From<"GlobalRequires", RuntimeContext>
      | HttpRouter.Request.From<"Error", RouteFailure>
      | HttpRouter.Request.From<"GlobalError", GlobalFailure>;
    const markedApplication = {} as ApplicationDefinition<never, never, Requirements>;
    const construction = makeApplicationHttpEffect(async () => markedApplication);
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
    expect(await HttpServerResponse.toWeb(response).text()).toBe("constructed:request:/lazy");
  });

  it("uses live request scope and runtime context instead of closed construction services", async () => {
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
      expect(await HttpServerResponse.toWeb(response).text()).toBe(`captured:${id}:/${id}`);
      expect(scopes.at(-1)).not.toBe(constructionScope);
      expect(finalized).toContain(id);
      expect(memoMaps.at(-1)).toEqual(Option.none());
      expect(metadataPresent.at(-1)).toBe(false);
    }
    expect(scopes.at(-1)).not.toBe(scopes.at(-2));
    expect(finalized).not.toContain("stale");
  });

  it("lets live capabilities override explicitly captured capabilities", async () => {
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
    expect(await HttpServerResponse.toWeb(response).text()).toBe("live:current:/override");
  });

  it("retains application capabilities in construction requirements", () => {
    const check = () => {
      // @ts-expect-error Construction requires Capability, but not host RuntimeContext.
      void Effect.runPromise(makeApplicationHttpEffect(async () => application));
    };
    expect(check).toBeTypeOf("function");
  });
});
