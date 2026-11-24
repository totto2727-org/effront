import { Deferred, Effect, Fiber, Function, Layer } from "effect";
import { HttpClient } from "effect/http";

import { BrowserEffectRunner } from "#core/client/browser-effect-runner.ts";
import { BrowserRenderer } from "#core/client/browser-renderer.ts";
import { installCallServer } from "#core/client/call-server.ts";
import { NavigationApi } from "#core/client/navigation-api.ts";
import { RouteLoader } from "#core/client/route-loader.ts";
import { RouteRefresher } from "#core/client/route-refresh.ts";
import { absentNavigationValue } from "./client-routing-events.fixture.ts";
import { makeNavigationEntry } from "./client-routing-navigation.fixture.ts";

export const listen = Effect.fn("effront.test.installServerFunctionCallback")(function* (
  dependencies: Layer.Layer<
    Effect.Services<typeof installCallServer>,
    never,
    HttpClient.HttpClient
  >,
) {
  const installed = yield* Deferred.make<boolean>();
  const acknowledge = Deferred.succeed(installed, true);
  const callServerLayer = Layer.effectDiscard(
    installCallServer.pipe(Effect.andThen(acknowledge)),
  ).pipe(Layer.provideMerge(dependencies));
  const running = yield* Layer.launch(callServerLayer).pipe(Effect.forkScoped);
  yield* Effect.raceFirst(Deferred.await(installed), Fiber.join(running));
});

export const firstEntry = makeNavigationEntry("entry-one", "https://effront.test/schedule/day-one");
export const secondEntry = makeNavigationEntry(
  "entry-two",
  "https://effront.test/schedule/day-two",
);

const unexpectedCall = (message: string): never => {
  // oxlint-disable-next-line rules/require-tagged-error -- An unexpected browser callback is a native fixture assertion failure.
  throw new TypeError(message);
};

export const rendererFor = (
  refresh: BrowserRenderer["Service"]["refresh"] = () =>
    unexpectedCall("Unexpected route refresh."),
): Layer.Layer<BrowserRenderer> =>
  BrowserRenderer.layerTest({
    commit: Function.constVoid,
    initialize: Function.constVoid,
    navigate: () => unexpectedCall("Unexpected navigation render."),
    refresh,
  });

export const navigationFor = (
  getCurrentEntry: NavigationApi["Service"]["getCurrentEntry"] = () => firstEntry,
  getTransition: NavigationApi["Service"]["getTransition"] = () => absentNavigationValue,
): Layer.Layer<NavigationApi> =>
  NavigationApi.layerTest({
    getCurrentEntry,
    getCurrentUrl: () => getCurrentEntry()?.url ?? firstEntry.url,
    getTransition,
    navigate: () => unexpectedCall("Unexpected navigation."),
    reloadDocument: Function.constVoid,
    replaceDocument: Function.constVoid,
    subscribe: () => Function.constVoid,
  });

export const routeLoaderFor = (
  prepareRefresh: RouteLoader["Service"]["prepareRefresh"] = () => Function.constVoid,
): Layer.Layer<RouteLoader> =>
  RouteLoader.layerTest({
    invalidate: Function.constVoid,
    load: () => Effect.die("Unexpected route load."),
    loadInitial: Effect.die("Unexpected initial route load."),
    prepareRefresh,
  });

const idleCallServer = Layer.mergeAll(
  BrowserEffectRunner.layer,
  rendererFor(),
  navigationFor(),
  routeLoaderFor(),
  RouteRefresher.layerTest({}),
);

type MissingIdleService = Exclude<
  Effect.Services<typeof installCallServer>,
  Layer.Success<typeof idleCallServer>
>;

export const withoutNetwork: Layer.Layer<HttpClient.HttpClient> = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make(() => Effect.die("Unexpected HTTP request.")),
);

export const listenIdle = Effect.fn("effront.test.listenToIdleServerFunction")(function* (
  flight: Layer.Layer<MissingIdleService>,
) {
  yield* listen(Layer.merge(idleCallServer, flight)).pipe(Effect.provide(withoutNetwork));
});
