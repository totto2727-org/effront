import { resetTransitions } from "./route-refresh-react.fixture.ts";

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Deferred, Effect } from "effect";

import { isDiscard, renders } from "#core/client/browser-renderer-model.ts";

import { makeRouteTree, withBrowserRefresh } from "./route-refresh-browser.fixture.ts";
import {
  holdNavigation,
  routedNavigation,
  TestNavigation,
} from "./route-refresh-navigation.fixture.ts";
import { queuedRenderer, signal, streamRefresh } from "./route-refresh-stream.fixture.ts";
import type { StreamingRefresh } from "./route-refresh-stream.fixture.ts";

const isRefresh = renders.$is("Refresh");

const expectOpen = (stream: StreamingRefresh): void => {
  expect(stream.release).not.toHaveBeenCalled();
  expect(Deferred.isDoneUnsafe(stream.scopeClosed)).toBe(false);
};

const responseReleased = (stream: StreamingRefresh): Effect.Effect<void> =>
  Deferred.await(stream.released).pipe(
    Effect.andThen(Deferred.await(stream.scopeClosed)),
    Effect.asVoid,
  );

const expectOpenDuringNavigation = Effect.fn("effront.test.expectOpenDuringNavigation")(function* (
  navigation: TestNavigation,
  stream: StreamingRefresh,
) {
  holdNavigation(navigation, "push");
  navigation.dispatchEvent(routedNavigation());
  yield* Effect.yieldNow;
  expectOpen(stream);

  // The visible page may finish streaming while the replacement is pending.
  yield* signal(stream.finished);
  yield* responseReleased(stream);
});

describe("visible refresh response ownership", () => {
  beforeEach(resetTransitions);

  it.effect("keeps a visible refresh stream open while the next navigation is pending", () =>
    Effect.gen(function* () {
      const navigation = new TestNavigation();
      const { browserRenderer, next } = yield* queuedRenderer();
      const stream = yield* streamRefresh;

      yield* withBrowserRefresh(
        { browserRenderer, navigation, routeLoader: stream.loader },
        (refresh) =>
          Effect.gen(function* () {
            yield* refresh("server-function");
            const render = yield* next.pipe(
              Effect.filterOrElse(isRefresh, () => Effect.die("Expected a refresh render.")),
            );
            expect(render.routeTree).toBe(stream.tree);
            browserRenderer.commit(render);
            yield* Effect.yieldNow;
            expectOpen(stream);

            yield* expectOpenDuringNavigation(navigation, stream);
            expect(stream.release).toHaveBeenCalledOnce();
          }),
      );
    }),
  );
});

describe("previous visible refresh at replacement", () => {
  beforeEach(resetTransitions);

  it.effect("releases a streaming refresh when its replacement becomes visible", () =>
    Effect.gen(function* () {
      const navigation = new TestNavigation();
      const { browserRenderer, next } = yield* queuedRenderer();
      const stream = yield* streamRefresh;

      yield* withBrowserRefresh(
        { browserRenderer, navigation, routeLoader: stream.loader },
        (refresh) =>
          Effect.gen(function* () {
            yield* refresh("hmr-refresh");
            browserRenderer.commit(yield* next);
            yield* Effect.yieldNow;

            // Scheduling a successor does not remove the refreshed page from the screen.
            navigation.dispatchEvent(routedNavigation());
            browserRenderer.navigate(makeRouteTree("replacement"));
            const replacement = yield* next.pipe(Effect.tap(() => Effect.yieldNow));
            expect(stream.release).not.toHaveBeenCalled();

            browserRenderer.commit(replacement);
            yield* responseReleased(stream);
            expect({
              cached: stream.cached.mock.calls.length,
              released: stream.release.mock.calls.length,
            }).toStrictEqual({ cached: 0, released: 1 });
          }),
      );
    }),
  );
});

describe("refresh responses handed back to the runtime", () => {
  beforeEach(resetTransitions);

  it.effect("discards an uncommitted refresh before releasing its response", () =>
    Effect.gen(function* () {
      const navigation = new TestNavigation();
      const { browserRenderer, initial, next } = yield* queuedRenderer();
      const stream = yield* streamRefresh;

      yield* withBrowserRefresh(
        { browserRenderer, navigation, routeLoader: stream.loader },
        (refresh, interrupt) =>
          Effect.gen(function* () {
            yield* refresh("hmr-refresh");
            expect(isRefresh(yield* next)).toBe(true);
            yield* interrupt;
            const discard = yield* next.pipe(
              Effect.filterOrElse(isDiscard, () => Effect.die("Expected a discard render.")),
            );
            expect(discard.restore.routeTree).toBe(initial);
            expectOpen(stream);

            // React must acknowledge the discard before the old response can be cancelled.
            browserRenderer.commit(discard);
            yield* responseReleased(stream);
            expect({
              cached: stream.cached.mock.calls.length,
              released: stream.release.mock.calls.length,
            }).toStrictEqual({ cached: 0, released: 1 });
          }),
      );
    }),
  );
});

describe("refresh scope shutdown", () => {
  beforeEach(resetTransitions);

  it.effect("releases a visible refresh when the browser runtime shuts down", () =>
    Effect.gen(function* () {
      const navigation = new TestNavigation();
      const { browserRenderer, next } = yield* queuedRenderer();
      const stream = yield* streamRefresh;

      yield* withBrowserRefresh(
        { browserRenderer, navigation, routeLoader: stream.loader },
        (refresh) =>
          Effect.gen(function* () {
            yield* refresh("hmr-refresh");
            browserRenderer.commit(yield* next);
            yield* Effect.yieldNow;
            expect(stream.release).not.toHaveBeenCalled();
          }),
      );

      yield* Deferred.await(stream.scopeClosed);
      expect(stream.release).toHaveBeenCalledOnce();
    }),
  );
});
