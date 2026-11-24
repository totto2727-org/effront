import { Data, Deferred, Effect, Layer } from "effect";

import { FlightClient } from "#core/client/flight-client.ts";
import { InitialFlightStream } from "#core/client/initial-flight-stream.ts";
import type { RouteLoad } from "#core/client/route-loader.ts";
import { initialRouteTree } from "./client-routing-renderer.fixture.ts";

type Completed = Effect.Success<typeof Effect.void>;
const routeLoads = Data.taggedEnum<RouteLoad>();

export const makeControlledRoute = Effect.fn("effront.test.controlFlight")(function* (url: string) {
  const completed = yield* Deferred.make<Completed>();
  const released = Promise.withResolvers<Completed>();
  const cachedEntries: NavigationHistoryEntry[] = [];
  const resolvedUrl = new URL(url);
  const resource = routeLoads.Route({
    cache: (entry) => {
      cachedEntries.push(entry);
    },
    completed: Deferred.await(completed),
    release: Effect.sync(released.resolve),
    resolvedUrl,
    routeTree: { ...initialRouteTree, id: resolvedUrl.pathname },
  });
  return { cachedEntries, completed, released, resource };
});

// oxlint-disable-next-line unicorn/no-null -- The React Flight protocol uses null for absent form state and server function results.
const absentFlightValue = null;

const initialFlight = Effect.succeed({
  completed: Effect.void,
  payload: {
    formState: absentFlightValue,
    routeTree: initialRouteTree,
    serverFnResult: absentFlightValue,
  },
});

export const navigationFlightLayer = Layer.effect(
  FlightClient,
  Effect.map(FlightClient, (flightClient) =>
    FlightClient.of({ ...flightClient, loadInitial: initialFlight }),
  ),
).pipe(Layer.provide(FlightClient.layer), Layer.provide(InitialFlightStream.layer));
