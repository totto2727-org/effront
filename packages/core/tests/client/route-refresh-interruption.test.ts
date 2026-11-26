import { resetTransitions } from "./route-refresh-react.fixture.ts";

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Deferred, Effect, Function } from "effect";
import { vi } from "vitest";

import { isDiscard, renders } from "#core/client/browser-renderer-model.ts";

import { observePromise } from "./client-routing-candidate.fixture.ts";
import {
  committedRefresh,
  loaderFor,
  makeRouteTree,
  rendererFor,
  route,
  withBrowserRefresh,
} from "./route-refresh-browser.fixture.ts";
import { entry, routedNavigation, TestNavigation } from "./route-refresh-navigation.fixture.ts";
import {
  makeSignal,
  queuedRenderer,
  signal,
  streamRefresh,
} from "./route-refresh-stream.fixture.ts";

const isRefresh = renders.$is("Refresh");

describe("native navigation during refresh publication", () => {
  beforeEach(resetTransitions);

  it.effect("keeps response ownership when navigation interrupts refresh publication", () =>
    Effect.gen(function* () {
      const navigation = new TestNavigation();
      const { browserRenderer, next } = yield* queuedRenderer((render) => {
        if (!isRefresh(render)) {
          return true;
        }
        // Navigation arrives before the refresh has returned its render handle.
        navigation.dispatchEvent(routedNavigation());
        return false;
      });
      const allowLoad = yield* makeSignal();
      const stream = yield* streamRefresh;
      const routeLoader: typeof stream.loader = {
        ...stream.loader,
        load: (request) =>
          Deferred.await(allowLoad).pipe(Effect.andThen(stream.loader.load(request))),
      };
      yield* withBrowserRefresh({ browserRenderer, navigation, routeLoader }, (refresh) =>
        Effect.gen(function* () {
          yield* refresh("hmr-refresh");
          yield* Effect.yieldNow;
          yield* signal(allowLoad);
          const discard = yield* next;
          expect(isDiscard(discard)).toBe(true);
          expect({
            ends: Deferred.isDoneUnsafe(stream.scopeClosed),
            releases: stream.release.mock.calls,
          }).toStrictEqual({ ends: false, releases: [] });

          browserRenderer.commit(discard);
          yield* Deferred.await(stream.scopeClosed);
          expect(stream.release).toHaveBeenCalledOnce();
        }),
      );
    }),
  );
});

const interruptedRequest = Effect.gen(function* () {
  const started = yield* makeSignal();
  const interrupted = yield* makeSignal();
  const load = signal(started).pipe(
    Effect.andThen(Effect.never),
    Effect.onInterrupt(() => signal(interrupted)),
  );
  return { interrupted, load, started };
});

const prepareReplacement = Effect.gen(function* () {
  const first = yield* interruptedRequest;
  const response = route({
    cache: Function.constVoid,
    completed: Effect.void,
    release: Effect.void,
    resolvedUrl: new URL(entry.url),
    routeTree: makeRouteTree("second-refresh"),
  });
  const load = vi
    .fn<Parameters<typeof loaderFor>[0]>()
    .mockReturnValue(Effect.succeed(response))
    .mockReturnValueOnce(first.load);
  const next = Promise.withResolvers<ReturnType<typeof makeRouteTree>>();
  const browserRenderer = rendererFor((tree) => {
    next.resolve(tree);
    return committedRefresh();
  });
  return { browserRenderer, first, load, next, routeLoader: loaderFor(load) };
});

describe("refresh requests that supersede an active request", () => {
  beforeEach(resetTransitions);

  it.effect("interrupts a current-route refresh when another refresh source supersedes it", () =>
    Effect.gen(function* () {
      const navigation = new TestNavigation();
      const request = yield* interruptedRequest;
      const rootRefresh = vi.fn<typeof committedRefresh>(committedRefresh);
      const browserRenderer = rendererFor(rootRefresh);
      const routeLoader = loaderFor(() => request.load);

      yield* withBrowserRefresh(
        { browserRenderer, navigation, routeLoader },
        (refresh, interrupt) =>
          Effect.gen(function* () {
            yield* refresh("server-function");
            yield* Deferred.await(request.started);
            yield* interrupt;
            yield* Deferred.await(request.interrupted);
            expect(rootRefresh).not.toHaveBeenCalled();
          }),
      );
    }),
  );

  it.effect("replaces an older refresh when a newer development update arrives", () =>
    Effect.gen(function* () {
      const navigation = new TestNavigation();
      const { browserRenderer, first, load, next, routeLoader } = yield* prepareReplacement;

      yield* withBrowserRefresh({ browserRenderer, navigation, routeLoader }, (refresh) =>
        Effect.gen(function* () {
          yield* refresh("server-function");
          yield* Deferred.await(first.started);
          yield* refresh("server-function");
          yield* Deferred.await(first.interrupted);
          const nextRouteTree = yield* observePromise(next.promise);
          expect(nextRouteTree.id).toBe("second-refresh");
          expect(load).toHaveBeenCalledTimes(2);
        }),
      );
    }),
  );
});
