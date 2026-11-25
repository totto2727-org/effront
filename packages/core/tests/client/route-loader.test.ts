import type { FlightLoadError } from "#core/client/flight-client.ts";
import type { RouteLoad, RouteLoader, RouteResource } from "#core/client/route-loader.ts";
import { isDocumentLoad } from "#core/client/route-loader.ts";
import type { FlightPayload } from "#core/rsc/flight.ts";
import { assert, expect, it } from "@effect/vitest";
import type { Scope } from "effect";
import { Deferred, Effect } from "effect";
import { HttpClient } from "effect/http";
import { vi } from "vitest";
import type { TestNavigationEntry } from "./route-loader.fixture.ts";
import {
  flightPayload,
  makeHistory,
  makeHttpClient,
  makeNavigationEntry,
  makeRouteLoader,
  makeRouteTree,
} from "./route-loader.fixture.ts";

const decodedFlights = vi.hoisted((): FlightPayload[] => []);
const noFlights = 0;

vi.mock(import("@vitejs/plugin-rsc/browser"), () => ({
  createFromReadableStream: async <A>(): Promise<A> => {
    const payload = await Promise.resolve(decodedFlights.shift());
    // Flight's decoder API trusts the consumer-supplied type. Return the queued wire fixture.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The mock uses the same caller-selected type contract as the native Flight decoder.
    return payload as A;
  },
}));

const expectRoute = (resource: RouteLoad): RouteResource => {
  assert(!isDocumentLoad(resource));
  return resource;
};

const mockFlight = (id: string): void => {
  decodedFlights.push(flightPayload(makeRouteTree(id)));
};

const withRequests = <E>(
  run: (requestedUrls: string[]) => Effect.Effect<void, E, HttpClient.HttpClient | Scope.Scope>,
): Effect.Effect<void, E> =>
  Effect.suspend(() => {
    decodedFlights.length = noFlights;
    const requestedUrls: string[] = [];
    const client = makeHttpClient(requestedUrls);
    return Effect.scoped(
      run(requestedUrls).pipe(Effect.provideService(HttpClient.HttpClient, client)),
    );
  });

const firstEntry = (key = "slot-one"): TestNavigationEntry => makeNavigationEntry("one", key);
const secondEntry = (key = "slot-two"): TestNavigationEntry => makeNavigationEntry("two", key);

it.effect("does not let initial Flight completion overwrite a refreshed cache generation", () =>
  withRequests((requestedUrls) =>
    Effect.gen(function* () {
      const entry = firstEntry();
      const history = makeHistory(entry);
      const initialFlight = yield* Deferred.make<boolean>();
      const loader = yield* makeRouteLoader(
        history,
        makeRouteTree("initial"),
        Deferred.await(initialFlight).pipe(Effect.asVoid),
      );
      const commitRefresh = loader.prepareRefresh(makeRouteTree("refreshed"));
      commitRefresh();
      yield* Deferred.succeed(initialFlight, true);
      yield* Effect.yieldNow;

      const resource = yield* loader.load({ destination: entry, navigationType: "traverse" });
      expect({ id: expectRoute(resource).routeTree.id, requestedUrls }).toStrictEqual({
        id: "refreshed",
        requestedUrls: [],
      });
    }),
  ),
);

it.effect("invalidates cached history entries before a development refresh", () =>
  withRequests((requestedUrls) =>
    Effect.gen(function* () {
      const entry = firstEntry();
      const history = makeHistory(entry);
      const loader = yield* makeRouteLoader(history, makeRouteTree("initial"));
      yield* Effect.yieldNow;
      loader.invalidate();
      mockFlight("reloaded");

      const resource = yield* loader.load({ destination: entry, navigationType: "traverse" });
      expect(expectRoute(resource).routeTree.id).toBe("reloaded");
      expect(requestedUrls).toStrictEqual([entry.url]);
    }),
  ),
);

it.effect("fences an in-flight navigation cache write when a refresh invalidates it", () =>
  withRequests((requestedUrls) =>
    Effect.gen(function* () {
      const entry = firstEntry();
      const history = makeHistory(entry);
      const loader = yield* makeRouteLoader(history, makeRouteTree("initial"));
      mockFlight("navigation");
      const inFlight = yield* loader.load({ destination: entry, navigationType: "push" });
      const commitRefresh = loader.prepareRefresh(makeRouteTree("refreshed"));
      commitRefresh();
      expectRoute(inFlight).cache(entry);

      const cached = yield* loader.load({ destination: entry, navigationType: "traverse" });
      expect({ id: expectRoute(cached).routeTree.id, requestedUrls }).toStrictEqual({
        id: "refreshed",
        requestedUrls: [entry.url],
      });
    }),
  ),
);

it.effect("attributes a refresh to the history entry where it started", () =>
  withRequests((requestedUrls) =>
    Effect.gen(function* () {
      const first = firstEntry();
      const second = secondEntry();
      const history = makeHistory(first);
      const loader = yield* makeRouteLoader(history, makeRouteTree("initial"));

      const commitRefresh = loader.prepareRefresh(makeRouteTree("refreshed"));
      history.currentEntry = second;
      commitRefresh();
      const firstCached = yield* loader.load({ destination: first, navigationType: "traverse" });
      expect(expectRoute(firstCached).routeTree.id).toBe("refreshed");
      expect(requestedUrls).toStrictEqual([]);
    }),
  ),
);

const sharedSlot = "shared-slot";
const sharedHistory = (): Readonly<{
  first: TestNavigationEntry;
  history: ReturnType<typeof makeHistory>;
  second: TestNavigationEntry;
}> => {
  const first = firstEntry(sharedSlot);
  const second = secondEntry(sharedSlot);
  return { first, history: makeHistory(first), second };
};

const cacheSecondEntry = (
  loader: RouteLoader["Service"],
  entry: TestNavigationEntry,
): Effect.Effect<void, FlightLoadError, Scope.Scope> =>
  Effect.gen(function* () {
    mockFlight("second");
    const resource = yield* loader.load({ destination: entry, navigationType: "push" });
    expectRoute(resource).cache(entry);
  });

const reloadDisposedEntry = (entry: TestNavigationEntry): void => {
  entry.dispatchEvent(new Event("dispose"));
  mockFlight("second-reloaded");
};

it.effect("caches the supplied entry and evicts it on disposal", () =>
  withRequests((requestedUrls) =>
    Effect.gen(function* () {
      const { first, history, second } = sharedHistory();
      const loader = yield* makeRouteLoader(history, makeRouteTree("first"));
      yield* Effect.yieldNow;
      yield* cacheSecondEntry(loader, second);

      const firstCached = yield* loader.load({ destination: first, navigationType: "traverse" });
      const secondCached = yield* loader.load({ destination: second, navigationType: "traverse" });
      expect([
        expectRoute(firstCached).routeTree.id,
        expectRoute(secondCached).routeTree.id,
      ]).toStrictEqual(["first", "second"]);

      reloadDisposedEntry(second);
      const reloaded = yield* loader.load({ destination: second, navigationType: "traverse" });
      expect({ id: expectRoute(reloaded).routeTree.id, requestedUrls }).toStrictEqual({
        id: "second-reloaded",
        requestedUrls: [second.url, second.url],
      });
    }),
  ),
);
