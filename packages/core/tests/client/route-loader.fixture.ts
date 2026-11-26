import type { FlightLoadError } from "#core/client/flight-client.ts";
import { FlightClient } from "#core/client/flight-client.ts";
import { InitialFlightStream } from "#core/client/initial-flight-stream.ts";
import { NavigationApi } from "#core/client/navigation-api.ts";
import { RouteLoader } from "#core/client/route-loader.ts";
import type { FlightPayload } from "#core/rsc/flight.ts";
import { FlightMediaType } from "#core/rsc/flight.ts";
import type { RouteTreeModel } from "#core/rsc/route-tree.ts";
import { Data, Deferred, Effect, Fiber, Function, Layer } from "effect";
import type { Scope } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";

const FlightClientLayer = FlightClient.layer.pipe(Layer.provide(InitialFlightStream.layer));
// oxlint-disable-next-line unicorn/no-null -- The Navigation API and Flight encode absent slots as null.
const emptySlot = null;
const historyIndex = 0;

export const makeRouteTree = (id: string): RouteTreeModel => ({
  child: emptySlot,
  content: emptySlot,
  id,
});

export const flightPayload = (routeTree: RouteTreeModel): FlightPayload => ({
  formState: emptySlot,
  routeTree,
  serverFnResult: emptySlot,
});

export type TestNavigationEntry = NavigationHistoryEntry &
  Pick<NavigationDestination, "id" | "url">;

export const makeNavigationEntry = (day: string, key: string): TestNavigationEntry =>
  Object.assign(new EventTarget(), {
    getState: Function.constUndefined,
    id: `entry-${day}`,
    index: historyIndex,
    key,
    ondispose: emptySlot,
    sameDocument: true,
    url: `https://effront.test/schedule/day-${day}`,
  });

interface TestNavigationHistory {
  currentEntry: TestNavigationEntry;
}

export const makeHistory = (currentEntry: TestNavigationEntry): TestNavigationHistory => ({
  currentEntry,
});

class UnexpectedNavigation extends Data.TaggedError("UnexpectedNavigation") {}

export const makeHttpClient = (requestedUrls: string[]): HttpClient.HttpClient =>
  HttpClient.make((request) =>
    Effect.sync(() => {
      requestedUrls.push(request.url);
      const response = new Response(new Uint8Array(), {
        headers: { "content-type": FlightMediaType },
      });
      return HttpClientResponse.fromWeb(request, response);
    }),
  );

const makeNavigationApiLayer = (history: TestNavigationHistory): Layer.Layer<NavigationApi> =>
  NavigationApi.layerTest({
    getCurrentEntry: () => history.currentEntry,
    getCurrentUrl: () => history.currentEntry.url,
    getTransition: () => emptySlot,
    navigate: () => {
      throw new UnexpectedNavigation();
    },
    reloadDocument: Function.constVoid,
    replaceDocument: Function.constVoid,
    subscribe: () => Function.constVoid,
  });

const makeFlightClientLayer = (
  initialRouteTree: RouteTreeModel,
  completed: Effect.Effect<void>,
): Layer.Layer<FlightClient, never, HttpClient.HttpClient> =>
  Layer.effect(
    FlightClient,
    Effect.gen(function* () {
      const client = yield* FlightClient;
      return FlightClient.of({
        ...client,
        loadInitial: Effect.succeed({ completed, payload: flightPayload(initialRouteTree) }),
      });
    }),
  ).pipe(Layer.provide(FlightClientLayer));

export const makeRouteLoader = (
  history: TestNavigationHistory,
  initialRouteTree: RouteTreeModel,
  initialFlightCompleted: Effect.Effect<void> = Effect.void,
): Effect.Effect<RouteLoader["Service"], FlightLoadError, HttpClient.HttpClient | Scope.Scope> =>
  Effect.gen(function* () {
    const initialized = yield* Deferred.make<RouteLoader["Service"]>();
    const routeLoaderLayer = RouteLoader.layer.pipe(
      Layer.provide(makeFlightClientLayer(initialRouteTree, initialFlightCompleted)),
      Layer.provide(makeNavigationApiLayer(history)),
    );
    const initializedRouteLoaderLayer = Layer.effectDiscard(
      Effect.gen(function* () {
        const routeLoader = yield* RouteLoader;
        yield* routeLoader.loadInitial;
        yield* Deferred.succeed(initialized, routeLoader);
      }),
    ).pipe(Layer.provideMerge(routeLoaderLayer));
    const running = yield* Layer.launch(initializedRouteLoaderLayer).pipe(Effect.forkScoped);
    return yield* Effect.raceFirst(Deferred.await(initialized), Fiber.join(running));
  });
