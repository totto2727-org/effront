// oxlint-disable-next-line import/no-unassigned-import -- Vitest registers the browser decoder fixture before loading the navigation runtime.
import "./client-routing-rsc.fixture.ts";

import { expect, it } from "@effect/vitest";
import { Array, Effect, Exit, Function, Option } from "effect";

import { BrowserRenderer } from "#core/client/browser-renderer.ts";
import { makeGate, observePromise, trackFlight } from "./client-routing-candidate.fixture.ts";
import {
  invokeNavigationHandler,
  makePrecommitController,
  runPrecommit,
} from "./client-routing-commit.fixture.ts";
import { makeNavigationEvent, nativeNavigationGlobals } from "./client-routing-events.fixture.ts";
import { makeNavigationEntry, TestNavigationApi } from "./client-routing-navigation.fixture.ts";
import { listen } from "./client-routing-router.fixture.ts";

const firstUrl = "https://effront.test/schedule/day-two";
const nextUrl = "https://effront.test/schedule/day-three";

const retirementRenderer = Effect.sync(() => {
  const retired = makeGate();
  const ready = Promise.resolve();
  const renderer = BrowserRenderer.of({
    commit: Function.constVoid,
    initialize: Function.constVoid,
    navigate: () => ({
      committed: ready,
      discard: Function.constant(ready),
      retired: retired.promise,
    }),
    refresh: () => {
      // oxlint-disable-next-line rules/require-tagged-error -- The native renderer test fails if it invokes a refresh instead of navigation.
      throw new TypeError("Unexpected refresh.");
    },
  });
  return { renderer, retired };
});

const prepareFirstNavigation = Effect.fnUntraced(function* (
  navigation: TestNavigationApi,
  signal: AbortSignal,
) {
  const pending = makeNavigationEvent({ signal });
  const handlers: NavigationInterceptHandler[] = [];
  navigation.dispatch(pending.event);
  yield* runPrecommit(pending.interception(), makePrecommitController([], handlers));
  navigation.currentEntry = makeNavigationEntry("day-two", firstUrl);
  const commit = Option.getOrThrow(Array.head(handlers));
  yield* observePromise(invokeNavigationHandler(commit));
});

const committedFlight = Effect.gen(function* () {
  yield* nativeNavigationGlobals;
  const cancellation = new AbortController();
  const navigation = new TestNavigationApi();
  const { renderer, retired } = yield* retirementRenderer;
  const transport = trackFlight("streaming", "/schedule/day-three");
  yield* listen(navigation, { httpClient: transport.httpClient, renderer });
  yield* prepareFirstNavigation(navigation, cancellation.signal);
  return { cancellation, navigation, retired, transport };
});

const failedSuccessor = Effect.fnUntraced(function* (navigation: TestNavigationApi) {
  const successor = makeNavigationEvent({ destination: { url: nextUrl } });
  navigation.dispatch(successor.event);
  return yield* Effect.exit(runPrecommit(successor.interception(), makePrecommitController()));
});

it.effect("retains a committed Flight response until its render retires", () =>
  Effect.gen(function* () {
    const { cancellation, navigation, retired, transport } = yield* committedFlight;
    expect(transport.signal()?.aborted).toBe(false);
    cancellation.abort();
    yield* Effect.yieldNow;
    expect(transport.signal()?.aborted).toBe(false);
    const failure = yield* failedSuccessor(navigation);
    expect({
      aborted: transport.signal()?.aborted,
      failed: Exit.isFailure(failure),
    }).toStrictEqual({ aborted: false, failed: true });
    retired.open();
    yield* transport.aborted.wait;
    expect(transport.signal()?.aborted).toBe(true);
  }).pipe(Effect.scoped),
);
