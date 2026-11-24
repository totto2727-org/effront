import { live } from "@effect/vitest";
import type { ApplicationDefinition } from "@effront/core";
import { CloudflareEnvironment } from "alchemy/Cloudflare";
import { RuntimeContext } from "alchemy/RuntimeContext";
import { Context, Effect, Layer, Option } from "effect";
import type { Scope } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { assert, describe, expect, vi } from "vite-plus/test";

import { makeApplicationHttpEffect as makeConfiguredApplicationHttpEffect } from "./application-runtime.ts";
import { applicationHttpEffect, makeApplicationHttpEffect } from "./runtime.ts";

class Capability extends Context.Service<Capability, string>()("effront/test/alchemy/Capability") {}

interface Observation {
  metadata: boolean;
  memoMap: Option.Option<Layer.MemoMap>;
  scope: Scope.Scope;
}

const requests = new Map<string, Observation>();
const finalized = new Set<string>();

// This unit isolates capture from the renderer. The local workerd suite checks the real renderer.
// oxlint-disable-next-line vitest/prefer-import-in-mock -- The unit renderer supplies specific services, so its return type cannot implement the real renderer's generic contract.
vi.mock("@effront/core/http", () => ({
  toHttpEffect: () =>
    Effect.gen(function* () {
      const capability = yield* Capability;
      const runtime = yield* RuntimeContext;
      const request = yield* HttpServerRequest.HttpServerRequest;
      const scope = yield* Effect.scope;
      const memoMap = yield* Effect.serviceOption(Layer.CurrentMemoMap);
      const metadata = yield* Effect.serviceOption(CloudflareEnvironment);
      requests.set(runtime.id, { memoMap, metadata: Option.isSome(metadata), scope });
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          finalized.add(runtime.id);
        }),
      );
      return HttpServerResponse.text(`${capability}:${runtime.id}:${request.url}`);
    }),
}));

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The unit renderer ignores the definition; the workerd suite exercises a constructed RSC application.
const application = {} as ApplicationDefinition<never, never, Capability | RuntimeContext>;
const loadApplication = async (): Promise<typeof application> => {
  await Promise.resolve();
  return application;
};

const runtime = (id: string): RuntimeContext["Service"] => ({
  Type: "test",
  env: {},
  get: () => Effect.undefined,
  id,
  set: (key) => Effect.succeed(key),
});

const request = (path: string): HttpServerRequest.HttpServerRequest =>
  HttpServerRequest.fromWeb(new Request(`https://example.test${path}`));

const withRequest = <A, E, R>(
  handler: Effect.Effect<A, E, R>,
  id: string,
  pathname: string,
): Effect.Effect<
  A,
  E,
  Exclude<Exclude<Exclude<R, RuntimeContext>, HttpServerRequest.HttpServerRequest>, Scope.Scope>
> =>
  handler.pipe(
    Effect.provideService(RuntimeContext, runtime(id)),
    Effect.provideService(HttpServerRequest.HttpServerRequest, request(pathname)),
    Effect.scoped,
  );

const readText = (response: HttpServerResponse.HttpServerResponse): Effect.Effect<string> =>
  Effect.promise(async () => HttpServerResponse.toWeb(response).text());

const withConstructionServices = Effect.gen(function* () {
  const scope = yield* Effect.scope;
  const handler = yield* makeApplicationHttpEffect(loadApplication);
  return { handler, scope };
}).pipe(
  Effect.provideService(Capability, "captured"),
  Effect.provideService(RuntimeContext, runtime("stale")),
  Effect.provideService(Layer.CurrentMemoMap, Layer.makeMemoMapUnsafe()),
  Effect.provideService(
    CloudflareEnvironment,
    Effect.die("Construction metadata is request-owned"),
  ),
  Effect.provideService(HttpServerRequest.HttpServerRequest, request("/stale")),
  Effect.scoped,
);

const loadLive = Effect.fn(function* (
  id: string,
  handler: Effect.Success<typeof withConstructionServices>["handler"],
) {
  const response = yield* withRequest(handler, id, `/${id}`);
  const text = yield* readText(response);
  const observation = requests.get(id);
  assert.isDefined(observation);
  return { finalized: finalized.has(id), ...observation, text };
});

describe("application construction for Alchemy", () => {
  live("reports a missing Vite integration only when the configured handler executes", () =>
    Effect.gen(function* () {
      const construction = makeConfiguredApplicationHttpEffect<typeof application>();
      const handler = yield* construction.pipe(Effect.provideService(Capability, "constructed"));
      const execution = withRequest(handler, "request", "/configured");
      const failure = yield* execution.pipe(Effect.catchDefect(Effect.fail), Effect.flip);
      expect(failure).toHaveProperty(
        "message",
        "Configured application loading requires effront() followed by effrontAlchemy().",
      );
    }),
  );

  live("captures capabilities without loading the application or requiring runtime services", () =>
    Effect.gen(function* () {
      const load = vi.fn<typeof loadApplication>(loadApplication);
      const construct = makeApplicationHttpEffect(load);
      const handler = yield* construct.pipe(Effect.provideService(Capability, "constructed"));
      expect(load).not.toHaveBeenCalled();
      const response = yield* withRequest(handler, "request", "/lazy");
      expect(load).toHaveBeenCalledOnce();
      expect(yield* readText(response)).toBe("constructed:request:/lazy");
    }),
  );
});

describe("native Alchemy request capabilities", () => {
  live("uses each live request scope and runtime context in place of construction services", () =>
    Effect.gen(function* () {
      const { handler, scope } = yield* withConstructionServices;
      const first = yield* loadLive("first", handler);
      const second = yield* loadLive("second", handler);
      const expected = { finalized: true, memoMap: Option.none(), metadata: false };
      expect(first).toMatchObject({ ...expected, text: "captured:first:/first" });
      expect(second).toMatchObject({ ...expected, text: "captured:second:/second" });
      expect(new Set([scope, first.scope, second.scope]).size).toBe(3);
      expect(finalized.has("stale")).toBe(false);
    }),
  );

  live("lets live capabilities override explicitly captured capabilities", () =>
    Effect.gen(function* () {
      const context = Context.make(Capability, "captured");
      const captured = applicationHttpEffect(loadApplication, { context });
      const handler = captured.pipe(Effect.provideService(Capability, "live"));
      const response = yield* withRequest(handler, "current", "/override");
      expect(yield* readText(response)).toBe("live:current:/override");
    }),
  );

  live("uses live capabilities when the capture parameter has no supplied context", () =>
    Effect.gen(function* () {
      const omitted = applicationHttpEffect<never, never, Capability | RuntimeContext, Capability>(
        loadApplication,
      );
      const options: Readonly<{ context?: Context.Context<Capability> }> = {};
      const optional = applicationHttpEffect(loadApplication, options);
      const body = yield* Effect.forEach([omitted, optional], (uncaptured) =>
        Effect.gen(function* () {
          const handler = uncaptured.pipe(Effect.provideService(Capability, "live"));
          const response = yield* withRequest(handler, "current", "/uncaptured");
          return yield* readText(response);
        }),
      );
      expect(body).toStrictEqual(["live:current:/uncaptured", "live:current:/uncaptured"]);
    }),
  );
});
