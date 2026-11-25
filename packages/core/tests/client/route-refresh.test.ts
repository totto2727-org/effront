import { resetTransitions } from "./route-refresh-react.fixture.ts";

import { beforeEach, expect, it } from "@effect/vitest";
import { Deferred, Effect } from "effect";
import { vi } from "vitest";

import { BrowserRenderer } from "#core/client/browser-renderer.ts";
import type { BrowserRender } from "#core/client/browser-renderer.ts";
import { RouteLoader } from "#core/client/route-loader.ts";

import {
  committedRefresh,
  makeRouteTree,
  withBrowserRefresh,
} from "./route-refresh-browser.fixture.ts";
import { entry, routedNavigation, TestNavigation } from "./route-refresh-navigation.fixture.ts";

beforeEach(resetTransitions);

const makeStreamingRefresh = Effect.gen(function* () {
  const streamFinished = yield* Deferred.make<void>();
  const streamReleased = yield* Deferred.make<void>();
  const responseScopeClosed = yield* Deferred.make<void>();
  const releaseStream = vi.fn();
  const cached = vi.fn();
  const refreshedTree = makeRouteTree("refreshed");
  const routeLoader = RouteLoader.of({
    invalidate: vi.fn(),
    load: () =>
      Effect.acquireRelease(
        Effect.succeed({
          _tag: "Route" as const,
          cache: () => undefined,
          completed: Deferred.await(streamFinished),
          release: Effect.sync(releaseStream).pipe(
            Effect.andThen(Deferred.succeed(streamReleased, undefined)),
          ),
          resolvedUrl: new URL(entry.url),
          routeTree: refreshedTree,
        }),
        () => Deferred.succeed(responseScopeClosed, undefined),
      ),
    loadInitial: Effect.die("Unexpected initial route load."),
    prepareRefresh: () => cached,
  });
  return {
    routeLoader,
    refreshedTree,
    streamFinished,
    streamReleased,
    responseScopeClosed,
    releaseStream,
    cached,
  };
});

it.effect("keeps a visible refresh stream open while the next navigation is pending", () =>
  Effect.gen(function* () {
    const navigation = new TestNavigation();
    const browserRenderer = yield* BrowserRenderer.make;
    const published = Promise.withResolvers<BrowserRender>();
    browserRenderer.initialize(makeRouteTree("initial"), published.resolve);

    const {
      routeLoader,
      refreshedTree,
      streamFinished,
      streamReleased,
      responseScopeClosed,
      releaseStream,
    } = yield* makeStreamingRefresh;

    yield* withBrowserRefresh({ browserRenderer, navigation, routeLoader }, (refresh) =>
      Effect.gen(function* () {
        // Commit the refreshed page while its server response is still streaming.
        yield* refresh("server-function");
        const render = yield* Effect.promise(() => published.promise);
        if (render._tag !== "Refresh") {
          return yield* Effect.die("Expected a refresh render.");
        }
        expect(render.routeTree).toBe(refreshedTree);
        browserRenderer.commit(render);
        yield* Effect.yieldNow;
        expect(releaseStream).not.toHaveBeenCalled();
        expect(Deferred.isDoneUnsafe(responseScopeClosed)).toBe(false);

        // Navigation starts, but the refreshed page stays visible until its replacement commits.
        const nextNavigation = Promise.withResolvers<void>();
        navigation.transition = {
          committed: nextNavigation.promise,
          finished: nextNavigation.promise,
          from: entry,
          navigationType: "push",
        };
        navigation.dispatchEvent(routedNavigation());
        yield* Effect.yieldNow;

        expect(releaseStream).not.toHaveBeenCalled();
        expect(Deferred.isDoneUnsafe(responseScopeClosed)).toBe(false);

        // The visible page can finish streaming; only then may its response be released.
        yield* Deferred.succeed(streamFinished, undefined);
        yield* Deferred.await(streamReleased);
        yield* Deferred.await(responseScopeClosed);
        expect(releaseStream).toHaveBeenCalledOnce();
      }),
    );
  }),
);

it.effect("releases a streaming refresh when its replacement becomes visible", () =>
  Effect.gen(function* () {
    const navigation = new TestNavigation();
    const browserRenderer = yield* BrowserRenderer.make;
    let published = Promise.withResolvers<BrowserRender>();
    browserRenderer.initialize(makeRouteTree("initial"), (render) => {
      published.resolve(render);
    });
    const { routeLoader, streamReleased, responseScopeClosed, releaseStream, cached } =
      yield* makeStreamingRefresh;

    yield* withBrowserRefresh({ browserRenderer, navigation, routeLoader }, (refresh) =>
      Effect.gen(function* () {
        yield* refresh("hmr-refresh");
        const render = yield* Effect.promise(() => published.promise);
        browserRenderer.commit(render);
        yield* Effect.yieldNow;

        // Scheduling a successor does not remove the refreshed page from the screen.
        published = Promise.withResolvers<BrowserRender>();
        navigation.dispatchEvent(routedNavigation());
        browserRenderer.navigate(makeRouteTree("replacement"));
        const replacement = yield* Effect.promise(() => published.promise);
        yield* Effect.yieldNow;
        expect(releaseStream).not.toHaveBeenCalled();

        browserRenderer.commit(replacement);
        yield* Deferred.await(streamReleased);
        yield* Deferred.await(responseScopeClosed);
        expect(releaseStream).toHaveBeenCalledOnce();
        expect(cached).not.toHaveBeenCalled();
      }),
    );
  }),
);

it.effect("discards an uncommitted refresh before releasing its response", () =>
  Effect.gen(function* () {
    const navigation = new TestNavigation();
    const browserRenderer = yield* BrowserRenderer.make;
    let published = Promise.withResolvers<BrowserRender>();
    const initialTree = makeRouteTree("initial");
    browserRenderer.initialize(initialTree, (render) => {
      published.resolve(render);
    });
    const { routeLoader, streamReleased, responseScopeClosed, releaseStream, cached } =
      yield* makeStreamingRefresh;

    yield* withBrowserRefresh({ browserRenderer, navigation, routeLoader }, (refresh, interrupt) =>
      Effect.gen(function* () {
        yield* refresh("hmr-refresh");
        const pending = yield* Effect.promise(() => published.promise);
        expect(pending._tag).toBe("Refresh");

        published = Promise.withResolvers<BrowserRender>();
        yield* interrupt;
        const discard = yield* Effect.promise(() => published.promise);
        if (discard._tag !== "Discard") {
          return yield* Effect.die("Expected a discard render.");
        }
        expect(discard.restore.routeTree).toBe(initialTree);
        expect(releaseStream).not.toHaveBeenCalled();
        expect(Deferred.isDoneUnsafe(responseScopeClosed)).toBe(false);

        // React must acknowledge the discard before the old response can be cancelled.
        browserRenderer.commit(discard);
        yield* Deferred.await(streamReleased);
        yield* Deferred.await(responseScopeClosed);
        expect(releaseStream).toHaveBeenCalledOnce();
        expect(cached).not.toHaveBeenCalled();
      }),
    );
  }),
);

it.effect("keeps response ownership when navigation interrupts refresh publication", () =>
  Effect.gen(function* () {
    const navigation = new TestNavigation();
    const browserRenderer = yield* BrowserRenderer.make;
    const discardPublished = Promise.withResolvers<BrowserRender>();
    browserRenderer.initialize(makeRouteTree("initial"), (render) => {
      if (render._tag === "Refresh") {
        // Navigation arrives during publication, before the refresh has returned its render handle.
        navigation.dispatchEvent(routedNavigation());
      } else {
        discardPublished.resolve(render);
      }
    });
    const allowLoad = yield* Deferred.make<void>();
    const { routeLoader, responseScopeClosed, releaseStream } = yield* makeStreamingRefresh;
    const delayedLoader = RouteLoader.of({
      ...routeLoader,
      load: (request) => Deferred.await(allowLoad).pipe(Effect.andThen(routeLoader.load(request))),
    });

    yield* withBrowserRefresh(
      { browserRenderer, navigation, routeLoader: delayedLoader },
      (refresh) =>
        Effect.gen(function* () {
          yield* refresh("hmr-refresh");
          yield* Effect.yieldNow;
          yield* Deferred.succeed(allowLoad, undefined);
          const discard = yield* Effect.promise(() => discardPublished.promise);
          expect(discard._tag).toBe("Discard");
          expect(releaseStream).not.toHaveBeenCalled();
          expect(Deferred.isDoneUnsafe(responseScopeClosed)).toBe(false);

          browserRenderer.commit(discard);
          yield* Deferred.await(responseScopeClosed);
          expect(releaseStream).toHaveBeenCalledOnce();
        }),
    );
  }),
);

it.effect("releases a visible refresh when the browser runtime shuts down", () =>
  Effect.gen(function* () {
    const navigation = new TestNavigation();
    const browserRenderer = yield* BrowserRenderer.make;
    const published = Promise.withResolvers<BrowserRender>();
    browserRenderer.initialize(makeRouteTree("initial"), published.resolve);
    const { routeLoader, responseScopeClosed, releaseStream } = yield* makeStreamingRefresh;

    yield* withBrowserRefresh({ browserRenderer, navigation, routeLoader }, (refresh) =>
      Effect.gen(function* () {
        yield* refresh("hmr-refresh");
        const render = yield* Effect.promise(() => published.promise);
        browserRenderer.commit(render);
        yield* Effect.yieldNow;
        expect(releaseStream).not.toHaveBeenCalled();
      }),
    );

    yield* Deferred.await(responseScopeClosed);
    expect(releaseStream).toHaveBeenCalledOnce();
  }),
);

it.effect("interrupts a current-route refresh when another refresh source supersedes it", () =>
  Effect.gen(function* () {
    const navigation = new TestNavigation();
    const loadStarted = yield* Deferred.make<void>();
    const loadInterrupted = yield* Deferred.make<void>();
    const rootRefresh = vi.fn(committedRefresh);
    const routeLoader = RouteLoader.of({
      invalidate: vi.fn(),
      load: () =>
        Deferred.succeed(loadStarted, undefined).pipe(
          Effect.andThen(Effect.never),
          Effect.onInterrupt(() => Deferred.succeed(loadInterrupted, undefined)),
        ),
      loadInitial: Effect.die("Unexpected initial route load."),
      prepareRefresh: () => () => undefined,
    });
    const browserRenderer = BrowserRenderer.of({
      commit: () => undefined,
      initialize: () => undefined,
      navigate: () => {
        throw new TypeError("Unexpected navigation render.");
      },
      refresh: rootRefresh,
    });

    yield* withBrowserRefresh({ browserRenderer, navigation, routeLoader }, (refresh, interrupt) =>
      Effect.gen(function* () {
        yield* refresh("server-function");
        yield* Deferred.await(loadStarted);
        yield* interrupt;
        yield* Deferred.await(loadInterrupted);

        expect(rootRefresh).not.toHaveBeenCalled();
      }),
    );
  }),
);

it.effect("replaces an older refresh when a newer development update arrives", () =>
  Effect.gen(function* () {
    const navigation = new TestNavigation();
    const firstStarted = yield* Deferred.make<void>();
    const firstInterrupted = yield* Deferred.make<void>();
    const secondRendered = Promise.withResolvers<RouteTreeModel>();
    let loadCount = 0;
    const routeLoader = RouteLoader.of({
      invalidate: vi.fn(),
      load: () => {
        loadCount += 1;
        return loadCount === 1
          ? Deferred.succeed(firstStarted, undefined).pipe(
              Effect.andThen(Effect.never),
              Effect.onInterrupt(() => Deferred.succeed(firstInterrupted, undefined)),
            )
          : Effect.succeed({
              _tag: "Route" as const,
              cache: () => undefined,
              completed: Effect.void,
              release: Effect.void,
              resolvedUrl: new URL(entry.url),
              routeTree: makeRouteTree("second-refresh"),
            });
      },
      loadInitial: Effect.die("Unexpected initial route load."),
      prepareRefresh: () => () => undefined,
    });
    const browserRenderer = BrowserRenderer.of({
      commit: () => undefined,
      initialize: () => undefined,
      navigate: () => {
        throw new TypeError("Unexpected navigation render.");
      },
      refresh: (nextRouteTree) => {
        secondRendered.resolve(nextRouteTree);
        return committedRefresh();
      },
    });

    yield* withBrowserRefresh({ browserRenderer, navigation, routeLoader }, (refresh) =>
      Effect.gen(function* () {
        yield* refresh("server-function");
        yield* Deferred.await(firstStarted);
        yield* refresh("server-function");
        yield* Deferred.await(firstInterrupted);

        const nextRouteTree = yield* Effect.promise(() => secondRendered.promise);
        expect(nextRouteTree.id).toBe("second-refresh");
        expect(loadCount).toBe(2);
      }),
    );
  }),
);
