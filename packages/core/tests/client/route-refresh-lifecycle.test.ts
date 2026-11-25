import { readTransitions, resetTransitions } from "./route-refresh-react.fixture.ts";

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Deferred, Effect, Function, Layer } from "effect";
import { vi } from "vitest";

import { loadFailure } from "#core/client/flight-client-model.ts";
import { RouteRefresher } from "#core/client/route-refresh.ts";

import { observePromise } from "./client-routing-candidate.fixture.ts";
import { absentNavigationValue } from "./client-routing-events.fixture.ts";
import {
  committedRefresh,
  loaderFor,
  makeRouteTree,
  openBrowserRefresh,
  rendererFor,
  route,
} from "./route-refresh-browser.fixture.ts";
import type { Refresh } from "./route-refresh-browser.fixture.ts";
import {
  entry,
  makeNavigationApiLayer,
  routedNavigation,
  TestNavigation,
} from "./route-refresh-navigation.fixture.ts";

describe("initial route refresh service", () => {
  it.effect("reloads until the browser installs streamed refresh", () => {
    const navigation = new TestNavigation();
    const streamed = vi.fn<() => void>();
    const navigationLayer = makeNavigationApiLayer(navigation);
    const services = RouteRefresher.layer.pipe(Layer.provide(navigationLayer));
    return Effect.gen(function* () {
      const refresher = yield* RouteRefresher;
      yield* refresher.refreshCurrentRoute("server-function");
      expect(navigation.reloadDocument).toHaveBeenCalledOnce();
      yield* refresher.replace({
        interruptCurrentRouteRefresh: Effect.void,
        refreshCurrentRoute: () => Effect.sync(streamed),
      });
      yield* refresher.refreshCurrentRoute("server-function");
      expect(streamed).toHaveBeenCalledOnce();
      expect(navigation.reloadDocument).toHaveBeenCalledOnce();
    }).pipe(Effect.provide(services));
  });
});

type Completed = Effect.Success<typeof Effect.void>;
const holdNavigation = (navigation: TestNavigation): (() => void) => {
  const pending = Promise.withResolvers<Completed>();
  navigation.transition = {
    committed: Promise.resolve(),
    finished: pending.promise,
    from: entry,
    navigationType: "replace",
  };
  return (): void => {
    navigation.transition = absentNavigationValue;
    pending.resolve();
  };
};

const hmrResponse = (): ReturnType<typeof route> =>
  route({
    cache: Function.constVoid,
    completed: Effect.void,
    release: Effect.void,
    resolvedUrl: new URL(entry.url),
    routeTree: makeRouteTree("refreshed"),
  });

const prepareQueuedHmr = Effect.gen(function* () {
  const navigation = new TestNavigation();
  const releaseNavigation = holdNavigation(navigation);
  const loaded = yield* Deferred.make<boolean>();
  const rendered = Promise.withResolvers<ReturnType<typeof makeRouteTree>>();
  const invalidated = vi.fn<() => void>();
  const cached = vi.fn<() => void>();
  const response = hmrResponse();
  const loader = loaderFor(
    () => Deferred.succeed(loaded, true).pipe(Effect.as(response)),
    invalidated,
    cached,
  );
  const renderer = rendererFor((tree) => {
    rendered.resolve(tree);
    return committedRefresh();
  });
  return { cached, invalidated, loaded, loader, navigation, releaseNavigation, rendered, renderer };
});

const startQueuedHmr = Effect.gen(function* () {
  const { loader, renderer, ...observed } = yield* prepareQueuedHmr;
  const refresher = yield* openBrowserRefresh({
    browserRenderer: renderer,
    navigation: observed.navigation,
    routeLoader: loader,
  });
  yield* refresher.refreshCurrentRoute("hmr-refresh");
  yield* Effect.yieldNow;
  return observed;
});

const readHmrRender = Effect.fn("effront.test.readHmrRouteRender")(function* (
  state: Effect.Success<typeof startQueuedHmr>,
) {
  state.releaseNavigation();
  const tree = yield* observePromise(state.rendered.promise);
  const { transitionResults, transitionTypes } = readTransitions();
  return {
    invalidated: state.invalidated.mock.calls.length,
    navigated: state.navigation.navigate.mock.calls.length,
    result: transitionResults,
    transitions: transitionTypes,
    tree: tree.id,
  };
});

describe("hmr refresh and native navigation", () => {
  beforeEach(resetTransitions);

  it.effect("applies the HMR transition after active navigation settles", () =>
    Effect.gen(function* () {
      const hmr = yield* startQueuedHmr;
      expect({
        loaded: Deferred.isDoneUnsafe(hmr.loaded),
        transitions: readTransitions().transitionTypes,
      }).toStrictEqual({ loaded: false, transitions: [] });
      // Returning an async Action here would make React wait for its own UI commit.
      expect(yield* readHmrRender(hmr)).toStrictEqual({
        invalidated: 1,
        navigated: 0,
        result: [undefined],
        transitions: ["hmr-refresh"],
        tree: "refreshed",
      });
      yield* Effect.yieldNow;
      expect(hmr.cached).toHaveBeenCalledOnce();
    }).pipe(Effect.scoped),
  );

  it.effect("leaves the current render untouched when refresh loading fails", () =>
    Effect.gen(function* () {
      const navigation = new TestNavigation();
      const finished = yield* Deferred.make<boolean>();
      const refresh = vi.fn<Refresh>(committedRefresh);
      const failure = Effect.fail(loadFailure("Refresh failed.", "RequestFailed"));
      const load = failure.pipe(Effect.ensuring(Deferred.succeed(finished, true)));
      const opened = yield* openBrowserRefresh({
        browserRenderer: rendererFor(refresh),
        navigation,
        routeLoader: loaderFor(() => load),
      });
      yield* opened.refreshCurrentRoute("server-function");
      yield* Deferred.await(finished);
      yield* Effect.yieldNow;
      expect(refresh).not.toHaveBeenCalled();
    }).pipe(Effect.scoped),
  );
});

const interruptedLoad = Effect.gen(function* () {
  const started = yield* Deferred.make<boolean>();
  const interrupted = yield* Deferred.make<boolean>();
  const closed = yield* Deferred.make<boolean>();
  const allocation = Effect.acquireRelease(Deferred.succeed(started, true), () =>
    Deferred.succeed(closed, true),
  );
  const load = allocation.pipe(
    Effect.andThen(Effect.never),
    Effect.onInterrupt(() => Deferred.succeed(interrupted, true)),
  );
  return { closed, interrupted, load, started };
});

const interruptByNavigation = Effect.fn("effront.test.interruptRefreshByNavigation")(function* (
  request: Effect.Success<typeof interruptedLoad>,
  navigation: TestNavigation,
) {
  yield* Deferred.await(request.started);
  navigation.dispatchEvent(routedNavigation());
  yield* Deferred.await(request.interrupted);
  yield* Deferred.await(request.closed);
});

describe("route refresh interruption by navigation", () => {
  beforeEach(resetTransitions);

  it.effect("closes an interrupted request without rendering or caching it", () =>
    Effect.gen(function* () {
      const navigation = new TestNavigation();
      const request = yield* interruptedLoad;
      const rendered = vi.fn<Refresh>(committedRefresh);
      const cached = vi.fn<() => void>();
      const refresher = yield* openBrowserRefresh({
        browserRenderer: rendererFor(rendered),
        navigation,
        routeLoader: loaderFor(() => request.load, Function.constVoid, cached),
      });
      yield* refresher.refreshCurrentRoute("server-function");
      yield* interruptByNavigation(request, navigation);
      expect({
        cached: cached.mock.calls.length,
        rendered: rendered.mock.calls.length,
      }).toStrictEqual({ cached: 0, rendered: 0 });
    }).pipe(Effect.scoped),
  );
});
