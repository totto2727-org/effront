import { Data, Deferred, Effect, Fiber, Function, Layer } from "effect";
import { HttpClient } from "effect/http";

import { BrowserEffectRunner } from "#core/client/browser-effect-runner.ts";
import { BrowserRenderer } from "#core/client/browser-renderer.ts";
import { RouteLoader } from "#core/client/route-loader.ts";
import type { RouteLoad } from "#core/client/route-loader.ts";
import { installRouteRefresh, RouteRefresher } from "#core/client/route-refresh.ts";
import type { RouteTreeModel } from "#core/rsc/route-tree.ts";

import { absentNavigationValue } from "./client-routing-events.fixture.ts";
import { makeNavigationApiLayer } from "./route-refresh-navigation.fixture.ts";
import type { TestNavigation } from "./route-refresh-navigation.fixture.ts";

type Completed = Effect.Success<typeof Effect.void>;

export type Refresh = BrowserRenderer["Service"]["refresh"];
type Load = RouteLoader["Service"]["load"];
export const route = Data.taggedEnum<RouteLoad>().Route;

export const rendererFor = (refresh: Refresh): BrowserRenderer["Service"] =>
  BrowserRenderer.of({
    commit: Function.constVoid,
    initialize: Function.constVoid,
    navigate: () => {
      // oxlint-disable-next-line rules/require-tagged-error -- Unexpected navigation is a native renderer fixture contract failure.
      throw new TypeError("Unexpected navigation render.");
    },
    refresh,
  });

export const loaderFor = (
  load: Load,
  invalidate: () => void = Function.constVoid,
  cached: () => void = Function.constVoid,
): RouteLoader["Service"] =>
  RouteLoader.of({
    invalidate,
    load,
    loadInitial: Effect.die("Unexpected initial route load."),
    prepareRefresh: () => cached,
  });

export const committedRefresh = (): ReturnType<BrowserRenderer["Service"]["refresh"]> => {
  const committed = Promise.resolve();
  return {
    committed,
    discard: Function.constant(committed),
    retired: Promise.withResolvers<Completed>().promise,
  };
};

export const makeRouteTree = (id: string): RouteTreeModel => ({
  child: absentNavigationValue,
  content: absentNavigationValue,
  id,
});

type BrowserFixture = Readonly<{
  browserRenderer: BrowserRenderer["Service"];
  navigation: TestNavigation;
  routeLoader: RouteLoader["Service"];
}>;

const testHttpClient = HttpClient.make(() => Effect.die("Unexpected HTTP request."));
const network = Layer.succeed(HttpClient.HttpClient, testHttpClient);

export const openBrowserRefresh = Effect.fnUntraced(function* ({
  browserRenderer,
  navigation,
  routeLoader,
}: BrowserFixture) {
  const initialized = yield* Deferred.make<RouteRefresher["Service"]>();
  const navigationLayer = makeNavigationApiLayer(navigation);
  const refresher = RouteRefresher.layer.pipe(Layer.provide(navigationLayer));
  const services = Layer.mergeAll(
    BrowserEffectRunner.layer,
    BrowserRenderer.layerTest(browserRenderer),
    navigationLayer,
    RouteLoader.layerTest(routeLoader),
    refresher,
  ).pipe(Layer.provideMerge(network));
  const install = installRouteRefresh.pipe(
    Effect.andThen(RouteRefresher),
    Effect.flatMap((value) => Deferred.succeed(initialized, value)),
  );
  const layer = Layer.effectDiscard(install).pipe(Layer.provideMerge(services));
  const running = yield* Layer.launch(layer).pipe(Effect.forkScoped);
  return yield* Effect.raceFirst(Deferred.await(initialized), Fiber.join(running));
});

type RequestRefresh = RouteRefresher["Service"]["refreshCurrentRoute"];
export const withBrowserRefresh = <A, E>(
  fixture: BrowserFixture,
  test: (refresh: RequestRefresh, interrupt: Effect.Effect<void>) => Effect.Effect<A, E>,
): Effect.Effect<A, E> =>
  openBrowserRefresh(fixture).pipe(
    Effect.flatMap(({ interruptCurrentRouteRefresh, refreshCurrentRoute }) =>
      test(refreshCurrentRoute, interruptCurrentRouteRefresh),
    ),
    Effect.scoped,
  );
