import { invokeServerFn, resetReactClient, transitionTypes } from "./call-server-react.fixture.ts";

import { beforeEach, expect, it } from "@effect/vitest";
import { Deferred, Effect, Layer } from "effect";
import { HttpClient } from "effect/http";
import { vi } from "vitest";

import { BrowserEffectRunner } from "#core/client/browser-effect-runner.ts";
import { BrowserRenderer } from "#core/client/browser-renderer.ts";
import type { BrowserRender } from "#core/client/browser-renderer.ts";
import { FlightClient } from "#core/client/flight-client.ts";
import { NavigationApi } from "#core/client/navigation-api.ts";
import { RouteLoader } from "#core/client/route-loader.ts";
import { RouteRefresher } from "#core/client/route-refresh.ts";

import { makeFlight, makeRouteTree } from "./call-server-mutation.fixture.ts";
import { firstEntry, listen } from "./call-server-service.fixture.ts";

beforeEach(resetReactClient);

it.effect("does not let an older invocation response overwrite a newer response", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const firstResponse = yield* Deferred.make<ReturnType<typeof makeFlight>>();
      const secondResponse = yield* Deferred.make<ReturnType<typeof makeFlight>>();
      const firstStarted = yield* Deferred.make<void>();
      const secondStarted = yield* Deferred.make<void>();
      const currentRouteRefresh = yield* Deferred.make<void>();
      const refreshTransitionTypes: string[] = [];
      const directRefreshCommitted = Promise.withResolvers<void>();
      const firstReleased = vi.fn();
      const interruptedCurrentRouteRefresh = vi.fn();
      const rendered: string[] = [];
      const navigationApiLayer = NavigationApi.layerTest({
        getCurrentEntry: () => firstEntry,
        getCurrentUrl: () => firstEntry.url,
        getTransition: () => null,
        navigate: () => {
          throw new TypeError("Unexpected navigation.");
        },
        reloadDocument: () => undefined,
        replaceDocument: () => undefined,
        subscribe: () => () => undefined,
      });
      const flightClientLayer = FlightClient.layerTest({
        load: (request) => {
          if (request._tag !== "ServerFunction") {
            return Effect.die("Unexpected navigation Flight load.");
          }
          return request.id === "first"
            ? Deferred.succeed(firstStarted, undefined).pipe(
                Effect.andThen(Deferred.await(firstResponse)),
              )
            : Deferred.succeed(secondStarted, undefined).pipe(
                Effect.andThen(Deferred.await(secondResponse)),
              );
        },
        loadInitial: Effect.die("Unexpected initial Flight load."),
      });
      const browserRendererLayer = BrowserRenderer.layerTest({
        commit: () => undefined,
        initialize: () => undefined,
        navigate: () => {
          throw new TypeError("Unexpected navigation render.");
        },
        refresh: (routeTree) => {
          rendered.push(routeTree.id);
          return {
            committed: Promise.resolve(),
            retired: Promise.withResolvers<void>().promise,
            discard: () => Promise.resolve(),
          };
        },
      });
      const routeLoaderLayer = RouteLoader.layerTest({
        invalidate: () => undefined,
        load: () => Effect.die("Unexpected route load."),
        loadInitial: Effect.die("Unexpected initial route load."),
        prepareRefresh: () => () => {
          directRefreshCommitted.resolve();
        },
      });
      const routeRefresherLayer = RouteRefresher.layerTest({
        interruptCurrentRouteRefresh: Effect.sync(interruptedCurrentRouteRefresh),
        refreshCurrentRoute: (transitionType) =>
          Effect.sync(() => refreshTransitionTypes.push(transitionType)).pipe(
            Effect.andThen(Deferred.succeed(currentRouteRefresh, undefined)),
          ),
        replace: () => Effect.void,
      });
      yield* listen(
        Layer.mergeAll(
          BrowserEffectRunner.layer,
          browserRendererLayer,
          flightClientLayer,
          navigationApiLayer,
          routeLoaderLayer,
          routeRefresherLayer,
        ),
      );

      const firstResult = invokeServerFn("first");
      yield* Deferred.await(firstStarted);
      const secondResult = invokeServerFn("second");
      yield* Deferred.await(secondStarted);
      yield* Deferred.succeed(secondResponse, makeFlight("newer", "second result", Effect.void));

      const secondValue = yield* Effect.promise(() => secondResult);
      expect(secondValue).toBe("second result");
      yield* Effect.promise(() => directRefreshCommitted.promise);
      expect(interruptedCurrentRouteRefresh).toHaveBeenCalledOnce();
      expect(transitionTypes()).toStrictEqual(["server-function"]);
      yield* Deferred.succeed(
        firstResponse,
        makeFlight("older", "first result", Effect.sync(firstReleased)),
      );

      const firstValue = yield* Effect.promise(() => firstResult);
      expect(firstValue).toBe("first result");
      yield* Deferred.await(currentRouteRefresh);
      expect(refreshTransitionTypes).toStrictEqual(["server-function"]);
      expect(rendered).toStrictEqual(["newer"]);
      expect(firstReleased).toHaveBeenCalledOnce();
    }).pipe(
      Effect.provideService(
        HttpClient.HttpClient,
        HttpClient.make(() => Effect.die("Unexpected HTTP request.")),
      ),
    ),
  ),
);

it.effect("releases a visible Server Function refresh when its replacement commits", () =>
  Effect.gen(function* () {
    const browserRenderer = yield* BrowserRenderer.make;
    let published = Promise.withResolvers<BrowserRender>();
    browserRenderer.initialize(makeRouteTree("initial"), (render) => {
      published.resolve(render);
    });
    const released = vi.fn();
    const cached = vi.fn();
    yield* listen(
      Layer.mergeAll(
        BrowserEffectRunner.layer,
        BrowserRenderer.layerTest(browserRenderer),
        FlightClient.layerTest({
          load: () =>
            Effect.succeed({
              ...makeFlight("refreshed", "saved", Effect.sync(released)),
              completed: Effect.never,
            }),
        }),
        NavigationApi.layerTest({
          getCurrentEntry: () => firstEntry,
          getCurrentUrl: () => firstEntry.url,
          getTransition: () => null,
          navigate: () => {
            throw new TypeError("Unexpected document navigation.");
          },
          reloadDocument: () => undefined,
          replaceDocument: () => undefined,
          subscribe: () => () => undefined,
        }),
        RouteLoader.layerTest({ invalidate: () => undefined, prepareRefresh: () => cached }),
        RouteRefresher.layerTest({ interruptCurrentRouteRefresh: Effect.void }),
      ),
    );

    const result = yield* Effect.promise(() => invokeServerFn("save"));
    expect(result).toBe("saved");
    const refresh = yield* Effect.promise(() => published.promise);
    browserRenderer.commit(refresh);

    // The refreshed page is still streaming while its replacement prepares.
    published = Promise.withResolvers<BrowserRender>();
    const replacement = browserRenderer.navigate(makeRouteTree("replacement"));
    const nextRender = yield* Effect.promise(() => published.promise);
    yield* Effect.yieldNow;
    expect(released).not.toHaveBeenCalled();

    browserRenderer.commit(nextRender);
    yield* Effect.promise(() => replacement.committed);
    yield* Effect.yieldNow;
    expect(released).toHaveBeenCalledOnce();
    expect(cached).not.toHaveBeenCalled();
  }).pipe(
    Effect.scoped,
    Effect.provideService(
      HttpClient.HttpClient,
      HttpClient.make(() => Effect.die("Unexpected HTTP request.")),
    ),
  ),
);

it.effect("releases a never-committed Server Function refresh after its successor commits", () =>
  Effect.gen(function* () {
    const browserRenderer = yield* BrowserRenderer.make;
    let published = Promise.withResolvers<BrowserRender>();
    browserRenderer.initialize(makeRouteTree("initial"), (render) => {
      published.resolve(render);
    });
    const released = vi.fn();
    const cached = vi.fn();
    yield* listen(
      Layer.mergeAll(
        BrowserEffectRunner.layer,
        BrowserRenderer.layerTest(browserRenderer),
        FlightClient.layerTest({
          load: () => Effect.succeed(makeFlight("refreshed", "saved", Effect.sync(released))),
        }),
        NavigationApi.layerTest({
          getCurrentEntry: () => firstEntry,
          getCurrentUrl: () => firstEntry.url,
          getTransition: () => null,
          navigate: () => {
            throw new TypeError("Unexpected document navigation.");
          },
          reloadDocument: () => undefined,
          replaceDocument: () => undefined,
          subscribe: () => () => undefined,
        }),
        RouteLoader.layerTest({ invalidate: () => undefined, prepareRefresh: () => cached }),
        RouteRefresher.layerTest({ interruptCurrentRouteRefresh: Effect.void }),
      ),
    );

    const result = yield* Effect.promise(() => invokeServerFn("save"));
    expect(result).toBe("saved");
    const refresh = yield* Effect.promise(() => published.promise);
    expect(refresh._tag).toBe("Refresh");

    // The first stream has ended, but React has not committed its refresh.
    published = Promise.withResolvers<BrowserRender>();
    const replacement = browserRenderer.refresh(makeRouteTree("replacement"));
    const nextRender = yield* Effect.promise(() => published.promise);
    yield* Effect.yieldNow;
    expect(released).not.toHaveBeenCalled();

    browserRenderer.commit(nextRender);
    yield* Effect.promise(() => replacement.committed);
    yield* Effect.yieldNow;
    expect(released).toHaveBeenCalledOnce();
    expect(cached).not.toHaveBeenCalled();
  }).pipe(
    Effect.scoped,
    Effect.provideService(
      HttpClient.HttpClient,
      HttpClient.make(() => Effect.die("Unexpected HTTP request.")),
    ),
  ),
);
