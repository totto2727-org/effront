import { Data, Deferred, Effect } from "effect";

import { flightResources } from "#core/client/flight-client-model.ts";
import { RouteRefresher } from "#core/client/route-refresh.ts";
import type { ServerFnResult } from "#core/rsc/flight.ts";
import type { RouteTreeModel } from "#core/rsc/route-tree.ts";
import { firstEntry } from "./call-server-service.fixture.ts";

// oxlint-disable-next-line unicorn/no-null -- The Flight wire uses null for absent route content and form state.
const absent = null;
const result = Data.taggedEnum<ServerFnResult>();

export const makeRouteTree = (id: string): RouteTreeModel => ({
  child: absent,
  content: absent,
  id,
});

export const makeFlight = (
  id: string,
  value: unknown,
  release: Effect.Effect<void>,
): ReturnType<typeof flightResources.Flight> =>
  flightResources.Flight({
    completed: Effect.void,
    payload: {
      formState: absent,
      routeTree: makeRouteTree(id),
      serverFnResult: result.Success({ value }),
    },
    release,
    resolvedUrl: new URL(firstEntry.url),
  });

export const recordRefresh = Effect.fnUntraced(function* (onInterrupt: () => void) {
  const observed = yield* Deferred.make<boolean>();
  const recorded: string[] = [];
  const acknowledge = Deferred.succeed(observed, true);
  const layer = RouteRefresher.layerTest({
    interruptCurrentRouteRefresh: Effect.sync(onInterrupt),
    refreshCurrentRoute: (type) =>
      Effect.sync(() => {
        recorded.push(type);
      }).pipe(Effect.andThen(acknowledge), Effect.asVoid),
    replace: () => Effect.void,
  });
  return { layer, observed, recorded };
});
