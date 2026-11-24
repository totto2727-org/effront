import { Context, Data, Effect, Function, Layer, MutableRef, Predicate } from "effect";
import type { Scope } from "effect";

import type { FlightPayload } from "#core/rsc/flight.ts";
import type { RouteTreeModel } from "#core/rsc/route-tree.ts";
import { FlightClient } from "./flight-client.ts";
import type { FlightLoadError } from "./flight-client.ts";
import { flightRequests, flightResources } from "./flight-client-model.ts";
import { NavigationApi } from "./navigation-api.ts";
import { clearRoutes, storeRoute } from "./route-history-cache.ts";
import type { RouteCache } from "./route-history-cache.ts";

type CacheRoute = (entry: NavigationHistoryEntry) => void;
type CacheRef = MutableRef.MutableRef<RouteCache>;

export type RouteLoad = Data.TaggedEnum<{
  Document: { release: Effect.Effect<void> };
  Route: {
    cache: CacheRoute;
    completed: Effect.Effect<void, FlightLoadError>;
    release: Effect.Effect<void>;
    resolvedUrl: URL;
    routeTree: RouteTreeModel;
  };
}>;

export type RouteLoadRequest = Readonly<{
  destination: Pick<NavigationDestination, "id" | "url">;
  navigationType: NavigationType;
}>;

const routeLoads = Data.taggedEnum<RouteLoad>();

export type RouteResource = ReturnType<typeof routeLoads.Route>;

const isDocument = flightResources.$is("Document");

const inactiveHistoryIndex = -1;

const cacheCurrentRoute =
  (cacheRef: CacheRef, cache: RouteCache, routeTree: RouteTreeModel): CacheRoute =>
  (entry) => {
    if (MutableRef.get(cacheRef) === cache) {
      storeRoute(cache, entry, routeTree);
    }
  };

const makeLoad = (
  cacheRef: CacheRef,
  flightClient: FlightClient["Service"],
): ((request: RouteLoadRequest) => Effect.Effect<RouteLoad, FlightLoadError, Scope.Scope>) =>
  Effect.fnUntraced(function* (request: RouteLoadRequest) {
    const cache = MutableRef.get(cacheRef);
    const destination = new URL(request.destination.url);
    const cached =
      request.navigationType === "traverse" ? cache.get(request.destination.id) : undefined;
    if (Predicate.isNotNullish(cached)) {
      return routeLoads.Route({
        cache: Function.constVoid,
        completed: Effect.void,
        release: Effect.void,
        resolvedUrl: destination,
        routeTree: cached.routeTree,
      });
    }

    const resource = yield* flightClient.load(flightRequests.Navigation({ destination }));
    if (isDocument(resource)) {
      return resource;
    }
    const {
      completed,
      payload: { routeTree },
      release,
      resolvedUrl,
    } = resource;
    return routeLoads.Route({
      cache: cacheCurrentRoute(cacheRef, cache, routeTree),
      completed,
      release,
      resolvedUrl,
      routeTree,
    });
  });

const prepareCacheWrite = (
  cacheRef: CacheRef,
  navigationApi: NavigationApi["Service"],
): Readonly<{
  commit: (routeTree: RouteTreeModel) => void;
  entry: NavigationHistoryEntry | null;
}> => {
  const cache = MutableRef.get(cacheRef);
  const entry = navigationApi.getCurrentEntry();
  const commit = (routeTree: RouteTreeModel): void => {
    if (
      MutableRef.get(cacheRef) === cache &&
      Predicate.isNotNullish(entry) &&
      entry.index !== inactiveHistoryIndex
    ) {
      storeRoute(cache, entry, routeTree);
    }
  };
  return { commit, entry };
};

type InitialLoadServices = Readonly<{
  cacheRef: CacheRef;
  flightClient: FlightClient["Service"];
  navigationApi: NavigationApi["Service"];
  scope: Scope.Scope;
}>;

const loadInitial = ({
  cacheRef,
  flightClient,
  navigationApi,
  scope,
}: InitialLoadServices): Effect.Effect<FlightPayload, FlightLoadError> =>
  Effect.gen(function* () {
    const cacheWrite = prepareCacheWrite(cacheRef, navigationApi);
    const resource = yield* flightClient.loadInitial;

    if (Predicate.isNotNullish(cacheWrite.entry)) {
      yield* resource.completed.pipe(
        Effect.andThen(
          Effect.sync(() => {
            cacheWrite.commit(resource.payload.routeTree);
          }),
        ),
        Effect.forkIn(scope),
      );
    }
    return resource.payload;
  });

const makeRouteLoader = Effect.gen(function* () {
  const flightClient = yield* FlightClient;
  const navigationApi = yield* NavigationApi;
  const scope = yield* Effect.scope;
  const cacheRef = MutableRef.make<RouteCache>(new Map());

  const invalidate = (): void => {
    clearRoutes(MutableRef.get(cacheRef));
    MutableRef.set(cacheRef, new Map());
  };
  const prepareRefresh = (routeTree: RouteTreeModel) => {
    invalidate();
    const cacheWrite = prepareCacheWrite(cacheRef, navigationApi);
    return () => {
      cacheWrite.commit(routeTree);
    };
  };
  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      clearRoutes(MutableRef.get(cacheRef));
    }),
  );

  return {
    invalidate,
    load: makeLoad(cacheRef, flightClient),
    loadInitial: loadInitial({ cacheRef, flightClient, navigationApi, scope }),
    prepareRefresh,
  };
});

export class RouteLoader extends Context.Service<RouteLoader>()("effront/client/RouteLoader", {
  make: makeRouteLoader,
}) {
  // oxlint-disable-next-line rules/no-readonly -- The shared layer reference is fixed for this service.
  public static readonly layer = Layer.effect(this, this.make);

  // oxlint-disable-next-line rules/no-readonly -- Preserve the fixed reference used by test layers.
  public static readonly layerTest = Layer.mock(this);
}
