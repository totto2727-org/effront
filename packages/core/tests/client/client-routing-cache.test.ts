// oxlint-disable-next-line import/no-unassigned-import -- Vitest registers the browser decoder fixture before loading the navigation runtime.
import "./client-routing-rsc.fixture.ts";

import { expect, it } from "@effect/vitest";
import { Array, Deferred, Effect, Exit, MutableRef, Option } from "effect";
import { vi } from "vitest";

import {
  dayTwoUrl,
  dayThreeUrl,
  dayFourUrl,
  dayFiveUrl,
  fixtureRoutes,
  listenToControlledRoutes,
} from "./client-routing-cache.fixture.ts";
import type { ControlledFlight } from "./client-routing-cache.fixture.ts";
import {
  invokeNavigationHandler,
  makePrecommitController,
  prepareNavigation,
  runPrecommit,
} from "./client-routing-commit.fixture.ts";
import { makeNavigationEvent, TestAnchor } from "./client-routing-events.fixture.ts";
import { makeHeldFlight, makeHttpClient } from "./client-routing-http.fixture.ts";
import { makeNavigationEntry, TestNavigationApi } from "./client-routing-navigation.fixture.ts";
import type { BrowserRenderRequest } from "./client-routing-renderer.fixture.ts";
import { makeBrowserRenderer } from "./client-routing-renderer.fixture.ts";
import { listen } from "./client-routing-router.fixture.ts";

const browser = Effect.acquireRelease(
  Effect.sync(() => {
    vi.stubGlobal("HTMLAnchorElement", TestAnchor);
  }),
  () => Effect.sync(vi.unstubAllGlobals),
);
type CommitAcknowledgement = Readonly<{ finished: Promise<void>; settled: () => boolean }>;
const observeCommit = (handler: NavigationInterceptHandler): CommitAcknowledgement => {
  const settled = MutableRef.make(false);
  const wait = async (): Promise<void> => {
    await invokeNavigationHandler(handler);
    MutableRef.set(settled, true);
  };
  return { finished: wait(), settled: () => MutableRef.get(settled) };
};

const openHeldNavigation = Effect.gen(function* () {
  const navigation = new TestNavigationApi();
  const { complete, httpClient } = makeHeldFlight();
  yield* listen(navigation, { httpClient });
  const handler = yield* prepareNavigation(navigation, dayTwoUrl);
  const completion = observeCommit(handler);
  return { complete, completion };
});

it.effect("settles the post-commit handler before the Flight stream reaches EOF", () =>
  Effect.gen(function* () {
    yield* browser;
    const { complete, completion } = yield* openHeldNavigation;
    // oxlint-disable-next-line typescript/promise-function-async -- Observe settlement on the next native turn before sending EOF.
    yield* Effect.promise(() => Promise.resolve());
    expect(completion.settled()).toBe(true);
    complete();
    // oxlint-disable-next-line typescript/promise-function-async -- Observe the existing post-commit promise after closing the stream.
    yield* Effect.promise(() => completion.finished);
    expect(completion.settled()).toBe(true);
  }).pipe(Effect.scoped),
);

type HistoryEntry = ReturnType<typeof makeNavigationEntry>;

const waitForRelease = (route: ControlledFlight): Effect.Effect<void> =>
  // oxlint-disable-next-line typescript/promise-function-async -- Observe release of the existing Flight resource.
  Effect.promise(() => route.released.promise);

const finishFlight = Effect.fnUntraced(function* (route: ControlledFlight) {
  yield* Deferred.done(route.completed, Exit.void);
  yield* waitForRelease(route);
});

const commitEntry = Effect.fnUntraced(function* (
  navigation: TestNavigationApi,
  handler: NavigationInterceptHandler,
  entry: HistoryEntry,
) {
  navigation.currentEntry = entry;
  // oxlint-disable-next-line typescript/promise-function-async -- Await the native post-commit handler directly.
  yield* Effect.promise(() => invokeNavigationHandler(handler));
});

const observeFlightBeforeHistory = Effect.fnUntraced(function* (
  navigation: TestNavigationApi,
  route: ControlledFlight,
) {
  const commit = yield* prepareNavigation(navigation, dayTwoUrl);
  yield* finishFlight(route);
  const beforeCommit = Array.copy(route.cachedEntries);
  const entry = makeNavigationEntry("day-two", dayTwoUrl);
  yield* commitEntry(navigation, commit, entry);
  return { afterCommit: route.cachedEntries, beforeCommit, entry };
});

const observeHistoryBeforeFlight = Effect.fnUntraced(function* (
  navigation: TestNavigationApi,
  route: ControlledFlight,
) {
  const commit = yield* prepareNavigation(navigation, dayThreeUrl);
  const entry = makeNavigationEntry("day-three", dayThreeUrl);
  yield* commitEntry(navigation, commit, entry);
  const beforeCompletion = Array.copy(route.cachedEntries);
  navigation.currentEntry = makeNavigationEntry("unrelated", dayFiveUrl);
  yield* finishFlight(route);
  return { afterCompletion: route.cachedEntries, beforeCompletion, entry };
});

const retireBeforeCompletion = Effect.fnUntraced(function* (
  navigation: TestNavigationApi,
  route: ControlledFlight,
) {
  const commit = yield* prepareNavigation(navigation, dayFourUrl);
  const entry = makeNavigationEntry("day-four", dayFourUrl);
  yield* commitEntry(navigation, commit, entry);
  yield* prepareNavigation(navigation, dayFiveUrl);
  yield* waitForRelease(route);
  yield* Deferred.done(route.completed, Exit.void);
  yield* Effect.yieldNow;
  return route.cachedEntries;
});

it.effect("coordinates cache identity across Flight and history commit ordering", () =>
  Effect.gen(function* () {
    yield* browser;
    const navigation = new TestNavigationApi();
    const { dayFour, dayThree, dayTwo, routes } = yield* fixtureRoutes;
    yield* listenToControlledRoutes(navigation, routes);
    const early = yield* observeFlightBeforeHistory(navigation, dayTwo);
    expect({ after: early.afterCommit, before: early.beforeCommit }).toStrictEqual({
      after: [early.entry],
      before: [],
    });
    const late = yield* observeHistoryBeforeFlight(navigation, dayThree);
    expect({ after: late.afterCompletion, before: late.beforeCompletion }).toStrictEqual({
      after: [late.entry],
      before: [],
    });
    expect(yield* retireBeforeCompletion(navigation, dayFour)).toStrictEqual([]);
  }).pipe(Effect.scoped),
);

const navigateHistory = Effect.fnUntraced(function* (
  navigation: TestNavigationApi,
  target: HistoryEntry,
  navigationType: "push" | "traverse",
) {
  const pending =
    navigationType === "traverse"
      ? makeNavigationEvent({ destination: { key: target.key, url: target.url }, navigationType })
      : makeNavigationEvent();
  const handlers: NavigationInterceptHandler[] = [];
  navigation.dispatch(pending.event);
  yield* runPrecommit(pending.interception(), makePrecommitController([], handlers));
  yield* commitEntry(navigation, Option.getOrThrow(Array.head(handlers)), target);
});

const openHistory = Effect.gen(function* () {
  const navigation = new TestNavigationApi();
  const { currentEntry: starting } = navigation;
  const target = makeNavigationEntry("day-two", dayTwoUrl);
  const requestedUrls: string[] = [];
  const renders: BrowserRenderRequest[] = [];
  yield* listen(navigation, {
    httpClient: makeHttpClient(requestedUrls),
    renderer: makeBrowserRenderer(renders),
  });
  yield* Effect.yieldNow;
  return { navigation, renders, requestedUrls, starting, target };
});

it.effect("reuses completed route trees for back and forward traversals", () =>
  Effect.gen(function* () {
    yield* browser;
    const { navigation, renders, requestedUrls, starting, target } = yield* openHistory;
    yield* navigateHistory(navigation, target, "push");
    yield* navigateHistory(navigation, starting, "traverse");
    yield* navigateHistory(navigation, target, "traverse");
    expect({
      rendered: Array.map(renders, (render) => render.routeTree.id),
      requestedUrls,
    }).toStrictEqual({ rendered: ["root", "day-one", "root"], requestedUrls: [dayTwoUrl] });
  }).pipe(Effect.scoped),
);
