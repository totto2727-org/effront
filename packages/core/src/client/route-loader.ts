import { Predicate, Context, Effect, Layer, MutableRef } from "effect";

import type { RouteTreeModel } from "#core/rsc/route-tree.ts";
import { FlightClient } from "./flight-client.ts";
import type { FlightLoadError } from "./flight-client.ts";
import { NavigationApi } from "./navigation-api.ts";

type CachedRoute = Readonly<{
  entry: CacheHistoryEntry;
  onDispose: () => void;
  routeTree: RouteTreeModel;
}>;

type CacheHistoryEntry = Pick<
  NavigationHistoryEntry,
  "addEventListener" | "id" | "index" | "removeEventListener"
>;

type RouteCache = Map<string, CachedRoute>;

export type RouteLoad =
  | Readonly<{
      _tag: "Route";
      cache: (entry: NavigationHistoryEntry) => void;
      completed: Effect.Effect<void, FlightLoadError>;
      release: Effect.Effect<void>;
      resolvedUrl: URL;
      routeTree: RouteTreeModel;
    }>
  | Readonly<{
      _tag: "Document";
      release: Effect.Effect<void>;
    }>;

export type RouteLoadRequest = Readonly<{
  destination: Pick<NavigationDestination, "id" | "url">;
  navigationType: NavigationType;
}>;

export class RouteLoader extends Context.Service<RouteLoader>()("effront/client/RouteLoader", {
  make: Effect.gen(function* () {
    const flightClient = yield* FlightClient;
    const navigationApi = yield* NavigationApi;
    const scope = yield* Effect.scope;
    const cacheRef = MutableRef.make<RouteCache>(new Map());

    const remove = (cache: RouteCache, entry: CacheHistoryEntry): void => {
      const cached = cache.get(entry.id);
      if (cached?.entry === entry) {
        cache.delete(entry.id);
      }
    };

    const store = (
      cache: RouteCache,
      entry: CacheHistoryEntry,
      routeTree: RouteTreeModel,
    ): void => {
      const cached = cache.get(entry.id);
      if (cached?.entry !== entry) {
        cached?.entry.removeEventListener("dispose", cached.onDispose);
        const onDispose = (): void => remove(cache, entry);
        entry.addEventListener("dispose", onDispose, { once: true });
        cache.set(entry.id, { entry, onDispose, routeTree });
        return;
      }
      cache.set(entry.id, { ...cached, routeTree });
    };

    const clear = (cache: RouteCache): void => {
      for (const cached of cache.values()) {
        cached.entry.removeEventListener("dispose", cached.onDispose);
      }
      cache.clear();
    };

    const invalidate = (): void => {
      clear(MutableRef.get(cacheRef));
      MutableRef.set(cacheRef, new Map());
    };

    const cacheRoute =
      (cache: RouteCache, routeTree: RouteTreeModel) => (entry: NavigationHistoryEntry) => {
        if (MutableRef.get(cacheRef) !== cache) {
          return;
        }
        store(cache, entry, routeTree);
      };

    const prepareRefresh = (routeTree: RouteTreeModel) => {
      invalidate();
      const cache = MutableRef.get(cacheRef);
      const entry = navigationApi.getCurrentEntry();
      return () => {
        if (
          MutableRef.get(cacheRef) === cache &&
          Predicate.isNotNullish(entry) &&
          entry.index !== -1
        ) {
          store(cache, entry, routeTree);
        }
      };
    };

    const load = Effect.fnUntraced(function* (request: RouteLoadRequest) {
      const cache = MutableRef.get(cacheRef);
      if (request.navigationType === "traverse") {
        const cached = cache.get(request.destination.id);
        if (Predicate.isNotNullish(cached)) {
          return {
            _tag: "Route",
            cache: () => undefined,
            completed: Effect.void,
            release: Effect.void,
            resolvedUrl: new URL(request.destination.url),
            routeTree: cached.routeTree,
          } satisfies RouteLoad;
        }
      }

      const resource = yield* flightClient.load({
        _tag: "Navigation",
        destination: new URL(request.destination.url),
      });
      if (resource._tag === "Document") {
        return resource satisfies RouteLoad;
      }
      return {
        _tag: "Route",
        cache: cacheRoute(cache, resource.payload.routeTree),
        completed: resource.completed,
        release: resource.release,
        resolvedUrl: resource.resolvedUrl,
        routeTree: resource.payload.routeTree,
      } satisfies RouteLoad;
    });

    const loadInitial = Effect.gen(function* () {
      const cache = MutableRef.get(cacheRef);
      const entry = navigationApi.getCurrentEntry();
      const resource = yield* flightClient.loadInitial;

      if (Predicate.isNotNullish(entry)) {
        yield* resource.completed.pipe(
          Effect.andThen(
            Effect.sync(() => {
              if (MutableRef.get(cacheRef) === cache && entry.index !== -1) {
                store(cache, entry, resource.payload.routeTree);
              }
            }),
          ),
          Effect.forkIn(scope),
        );
      }

      return resource.payload;
    });

    yield* Effect.addFinalizer(() => Effect.sync(() => clear(MutableRef.get(cacheRef))));

    return { invalidate, load, loadInitial, prepareRefresh };
  }),
}) {
  static readonly layer = Layer.effect(this, this.make);

  static readonly layerTest = Layer.mock(this);
}
