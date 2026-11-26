// oxlint-disable-next-line import/no-unassigned-import -- Vitest registers the browser decoder fixture before loading the navigation runtime.
import "./client-routing-rsc.fixture.ts";

import { expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";

import {
  makeUncommittedRenderer,
  observePromise,
  startCandidatePrecommit,
  trackFlight,
} from "./client-routing-candidate.fixture.ts";
import { makeNavigationEvent, nativeNavigationGlobals } from "./client-routing-events.fixture.ts";
import { TestNavigationApi } from "./client-routing-navigation.fixture.ts";
import type { BrowserRenderRequest } from "./client-routing-renderer.fixture.ts";
import { makeBrowserRenderer } from "./client-routing-renderer.fixture.ts";
import { listen } from "./client-routing-router.fixture.ts";

const supersededUrl = "https://effront.test/schedule/day-three";
const startReplacement = (navigation: TestNavigationApi): void => {
  const replacement = makeNavigationEvent({ destination: { url: supersededUrl } });
  navigation.dispatch(replacement.event);
};

const scheduledCandidate = Effect.gen(function* () {
  yield* nativeNavigationGlobals;
  const cancellation = new AbortController();
  const navigation = new TestNavigationApi();
  const controlled = makeUncommittedRenderer();
  const transport = trackFlight("streaming");
  yield* listen(navigation, { httpClient: transport.httpClient, renderer: controlled.renderer });
  const { finished } = yield* startCandidatePrecommit(navigation, cancellation.signal);
  yield* controlled.renderStarted.wait;
  return { cancellation, controlled, finished, navigation, transport };
});

it.effect("cancels a streaming Flight response abandoned before React commits", () =>
  Effect.gen(function* () {
    const { cancellation, controlled, finished, transport } = yield* scheduledCandidate;
    expect(transport.signal()?.aborted).toBe(false);
    cancellation.abort();
    yield* controlled.discardStarted.wait;
    expect(transport.signal()?.aborted).toBe(false);
    controlled.allowDiscard.open();
    const completed = yield* observePromise(finished).pipe(Effect.exit);
    expect(Exit.isSuccess(completed)).toBe(true);
    expect(transport.signal()?.aborted).toBe(true);
  }).pipe(Effect.scoped),
);

const pendingCandidate = Effect.gen(function* () {
  yield* nativeNavigationGlobals;
  const cancellation = new AbortController();
  const navigation = new TestNavigationApi();
  const renders: BrowserRenderRequest[] = [];
  const transport = trackFlight("pending");
  yield* listen(navigation, {
    httpClient: transport.httpClient,
    renderer: makeBrowserRenderer(renders),
  });
  const { finished } = yield* startCandidatePrecommit(navigation, cancellation.signal);
  yield* transport.started.wait;
  return { cancellation, finished, navigation, renders, transport };
});

it.effect("interrupts a pending Flight load when a newer navigation starts", () =>
  Effect.gen(function* () {
    const { cancellation, finished, navigation, renders, transport } = yield* pendingCandidate;
    startReplacement(navigation);
    yield* transport.aborted.wait;
    yield* observePromise(finished);
    expect(cancellation.signal.aborted).toBe(false);
    expect(renders).toStrictEqual([]);
  }).pipe(Effect.scoped),
);

it.effect("discards and releases a scheduled candidate when a newer navigation starts", () =>
  Effect.gen(function* () {
    const { cancellation, controlled, finished, navigation, transport } = yield* scheduledCandidate;
    startReplacement(navigation);
    yield* controlled.discardStarted.wait;
    expect(transport.signal()?.aborted).toBe(false);
    controlled.allowDiscard.open();
    yield* transport.aborted.wait;
    expect(transport.signal()?.aborted).toBe(true);
    expect(cancellation.signal.aborted).toBe(false);
    yield* observePromise(finished);
  }).pipe(Effect.scoped),
);
