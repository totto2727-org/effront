// oxlint-disable-next-line import/no-unassigned-import -- Vitest registers the browser decoder fixture before loading the navigation runtime.
import "./client-routing-rsc.fixture.ts";

import { expect, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";

import type { BrowserRender } from "#core/client/browser-renderer.ts";
import { observePromise } from "./client-routing-candidate.fixture.ts";
import { makePrecommitController, runPrecommit } from "./client-routing-commit.fixture.ts";
import { makeNavigationEvent } from "./client-routing-events.fixture.ts";
import {
  commitHistory,
  committedFirstPage,
  nextUrl,
  openLiveRenderer,
  prepareRender,
} from "./client-routing-live.fixture.ts";
import type { LiveRenderer } from "./client-routing-live.fixture.ts";
import { makeNavigationEntry } from "./client-routing-navigation.fixture.ts";
import { initialRouteTree } from "./client-routing-renderer.fixture.ts";

const originalRequest = 0;
const replacementRequest = 1;

const aborted = ({
  responseSignals,
}: LiveRenderer): Readonly<{
  original: boolean | undefined;
  replacement: boolean | undefined;
}> => ({
  original: responseSignals[originalRequest]?.aborted,
  replacement: responseSignals[replacementRequest]?.aborted,
});

const commitSuccessor = Effect.fnUntraced(function* (
  fixture: LiveRenderer,
  { preparation, render }: Readonly<{ preparation: Fiber.Fiber<unknown>; render: BrowserRender }>,
) {
  fixture.renderer.commit(render);
  yield* Fiber.join(preparation);
  yield* Effect.yieldNow;
});

it.effect(
  "releases the previous navigation stream when the real renderer commits its successor",
  () =>
    Effect.gen(function* () {
      const fixture = yield* openLiveRenderer;
      yield* committedFirstPage(fixture);
      const successor = yield* prepareRender(fixture, nextUrl);
      expect(aborted(fixture).original).toBe(false);
      // Both router observers are waiting when React commits the successor.
      yield* commitSuccessor(fixture, successor);
      expect(aborted(fixture)).toStrictEqual({ original: true, replacement: false });
    }).pipe(Effect.scoped),
);

const queueSuccessor = Effect.fnUntraced(function* (fixture: LiveRenderer) {
  const first = makeNavigationEvent();
  fixture.navigation.dispatch(first.event);
  const preparation = yield* runPrecommit(first.interception(), makePrecommitController()).pipe(
    Effect.forkChild,
  );
  const render = yield* fixture.read();
  yield* Effect.yieldNow;
  const successor = makeNavigationEvent({ destination: { url: nextUrl } });
  // A child layout effect can queue navigation before the root resolves committed.
  // That microtask runs before the router processes the commit notification.
  queueMicrotask(() => {
    fixture.navigation.dispatch(successor.event);
  });
  yield* commitSuccessor(fixture, { preparation, render });
  return successor;
});

const publishQueuedSuccessor = Effect.fnUntraced(function* (
  fixture: LiveRenderer,
  pending: ReturnType<typeof makeNavigationEvent>,
) {
  fixture.reset();
  const preparation = yield* runPrecommit(pending.interception(), makePrecommitController()).pipe(
    Effect.forkChild,
  );
  const render = yield* fixture.read();
  return { preparation, render };
});

it.effect(
  "keeps a committed navigation stream alive when superseded before its commit notification",
  () =>
    Effect.gen(function* () {
      const fixture = yield* openLiveRenderer;
      const pending = yield* queueSuccessor(fixture);
      expect(fixture.responseSignals).toHaveLength(1);
      expect(aborted(fixture).original).toBe(false);
      const successor = yield* publishQueuedSuccessor(fixture, pending);
      expect(aborted(fixture).original).toBe(false);
      yield* commitSuccessor(fixture, successor);
      expect(aborted(fixture)).toStrictEqual({ original: true, replacement: false });
    }).pipe(Effect.scoped),
);

const queueRefreshDiscard = Effect.fnUntraced(function* (fixture: LiveRenderer) {
  const next = yield* prepareRender(fixture, nextUrl);
  // A cancelled refresh queues restoration of the first page before the second commits.
  const refresh = fixture.renderer.refresh(initialRouteTree);
  fixture.reset();
  const discarded = refresh.discard();
  const discardRender = yield* fixture.read();
  fixture.renderer.commit(next.render);
  yield* commitHistory(fixture.navigation, next, makeNavigationEntry("day-three", nextUrl));
  return { discardRender, discarded };
});

const retireRestoredPage = Effect.fnUntraced(function* (fixture: LiveRenderer) {
  fixture.reset();
  fixture.renderer.refresh(initialRouteTree);
  const replacement = yield* fixture.read();
  fixture.renderer.commit(replacement);
  yield* Effect.yieldNow;
});

it.effect("keeps an older navigation stream while a queued discard can restore it", () =>
  Effect.gen(function* () {
    const fixture = yield* openLiveRenderer;
    yield* committedFirstPage(fixture);
    const { discardRender, discarded } = yield* queueRefreshDiscard(fixture);
    expect(aborted(fixture)).toStrictEqual({ original: false, replacement: false });

    // The router has moved on, but React can still restore the first page.
    fixture.renderer.commit(discardRender);
    yield* observePromise(discarded);
    yield* Effect.yieldNow;
    expect(aborted(fixture)).toStrictEqual({ original: false, replacement: true });

    yield* retireRestoredPage(fixture);
    expect(aborted(fixture).original).toBe(true);
  }).pipe(Effect.scoped),
);
