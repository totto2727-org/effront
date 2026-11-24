import { afterEach, beforeEach, expect, it } from "@effect/vitest";
import { Predicate, Deferred, Effect, Exit, Fiber, Layer, Scope } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { vi } from "vitest";

import { BrowserEffectRunner } from "#core/client/browser-effect-runner.ts";
import { BrowserRenderer } from "#core/client/browser-renderer.ts";
import type { BrowserRender } from "#core/client/browser-renderer.ts";
import { installClientRouter } from "#core/client/client-router.ts";
import { RouteLoader } from "#core/client/route-loader.ts";

import { makeNavigationEvent, TestAnchor } from "./client-routing-events.fixture.ts";
import {
  makeNavigationApiLayer,
  makeNavigationEntry,
  TestNavigationApi,
} from "./client-routing-navigation.fixture.ts";

import {
  makeHttpClient,
  makeInvalidFlightClient,
  makeStreamingHttpClient,
} from "./client-routing-http.fixture.ts";
import {
  initialRouteTree,
  makeBrowserRenderer,
  renderRequests,
} from "./client-routing-renderer.fixture.ts";
import type { BrowserRenderRequest } from "./client-routing-renderer.fixture.ts";

import {
  invokeNavigationHandler,
  invokePrecommitHandler,
  makePrecommitController,
  prepareNavigation,
} from "./client-routing-commit.fixture.ts";
import { makeControlledRoute } from "./client-routing-flight.fixture.ts";
import { listen } from "./client-routing-router.fixture.ts";

const react = vi.hoisted(() => ({
  transitionTypes: [] as string[],
}));

vi.mock("react", (importOriginal) =>
  importOriginal<typeof import("react")>().then((original) => ({
    ...original,
    addTransitionType: (type: string) => {
      react.transitionTypes.push(type);
    },
  })),
);

vi.mock("@vitejs/plugin-rsc/browser", () => ({
  createFromReadableStream: vi.fn((stream: ReadableStream<Uint8Array>) => {
    const reader = stream.getReader();
    return reader.read().then(() => {
      void reader.read().catch(() => undefined);
      return {
        formState: null,
        routeTree: {
          child: null,
          content: null,
          id: "root",
        },
        serverFnResult: null,
      };
    });
  }),
}));

beforeEach(() => {
  react.transitionTypes.length = 0;
  vi.stubGlobal("HTMLAnchorElement", TestAnchor);
});

afterEach(() => vi.unstubAllGlobals());

it.effect("splits a cancelable navigation between React commit and Flight completion", () =>
  Effect.gen(function* () {
    const navigation = new TestNavigationApi();
    const requestedUrls: string[] = [];
    const renders: BrowserRenderRequest[] = [];
    yield* Effect.scoped(
      Effect.gen(function* () {
        yield* listen(navigation, {
          httpClient: makeHttpClient(requestedUrls),
          renderer: makeBrowserRenderer(renders),
        });
        const pendingNavigation = makeNavigationEvent({ hasUAVisualTransition: true });

        navigation.dispatch(pendingNavigation.event);

        const interception = pendingNavigation.interception();
        expect(interception?.handler).toBeUndefined();
        expect(interception?.precommitHandler).toBeTypeOf("function");
        const precommitHandler = interception?.precommitHandler;
        if (Predicate.isNullish(precommitHandler)) {
          return yield* Effect.die("Expected a precommit handler.");
        }

        const handlers: NavigationInterceptHandler[] = [];
        yield* Effect.promise(() =>
          invokePrecommitHandler(precommitHandler, makePrecommitController([], handlers)),
        );
        expect(handlers).toHaveLength(1);
        const handler = handlers[0];
        if (Predicate.isNullish(handler)) {
          return yield* Effect.die("Expected a post-commit handler.");
        }
        yield* Effect.promise(() => invokeNavigationHandler(handler));

        expect(requestedUrls).toStrictEqual(["https://effront.test/schedule/day-two"]);
        expect(renders).toHaveLength(1);
        const render = renders[0];
        if (Predicate.isNullish(render) || !renderRequests.$is("Navigation")(render)) {
          return yield* Effect.die("Expected a navigation render.");
        }
        expect(render.routeTree.id).toBe("root");
        expect(react.transitionTypes).toStrictEqual([
          "navigation",
          "navigation-push",
          "navigation-ua-visual-transition",
          "navigation-forward",
        ]);
      }),
    );
  }),
);

it.effect("snapshots link types before loading and keeps them local to the navigation", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const navigation = new TestNavigationApi();
      yield* listen(navigation);
      const anchor = new TestAnchor({
        effrontTransitionTypes: " docs-previous\tsection-change docs-previous\n",
      });
      const pending = makeNavigationEvent({ sourceElement: anchor });
      navigation.dispatch(pending.event);
      anchor.dataset["effrontTransitionTypes"] = "docs-next";
      expect(react.transitionTypes).toStrictEqual([]);

      const handler = pending.interception()?.precommitHandler;
      if (Predicate.isNullish(handler)) {
        return yield* Effect.die("Expected a precommit handler.");
      }
      yield* Effect.promise(() => invokePrecommitHandler(handler, makePrecommitController()));
      expect(react.transitionTypes).toStrictEqual([
        "navigation",
        "navigation-push",
        "navigation-forward",
        "docs-previous",
        "section-change",
      ]);

      react.transitionTypes.length = 0;
      yield* prepareNavigation(navigation, "https://effront.test/schedule/day-two");
      expect(react.transitionTypes).toStrictEqual([
        "navigation",
        "navigation-push",
        "navigation-forward",
      ]);
    }),
  ),
);

it.effect("reserves only EFFRONT-owned types and preserves application tokens unchanged", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const navigation = new TestNavigationApi();
      const renders: BrowserRenderRequest[] = [];
      yield* listen(navigation, { renderer: makeBrowserRenderer(renders) });
      const applicationTypes = [
        "docs-jump",
        "NAVIGATION-BACKWARD",
        "none",
        "initial",
        "default",
        "constructor",
        "toString",
        "1custom",
        "custom/type",
        "étape-suivante",
      ];
      const pending = makeNavigationEvent({
        navigationType: "replace",
        sourceElement: new TestAnchor({
          effrontTransitionTypes: [
            "navigation",
            "navigation-backward",
            "navigation-custom",
            "server-function",
            "hmr-refresh",
            ...applicationTypes,
          ].join(" "),
        }),
      });
      navigation.dispatch(pending.event);
      const handler = pending.interception()?.precommitHandler;
      if (Predicate.isNullish(handler)) {
        return yield* Effect.die("Expected a precommit handler.");
      }
      yield* Effect.promise(() => invokePrecommitHandler(handler, makePrecommitController()));
      expect(renders).toHaveLength(1);
      expect(react.transitionTypes).toStrictEqual([
        "navigation",
        "navigation-replace",
        ...applicationTypes,
      ]);
    }),
  ),
);

it.effect("does not read link types for a history traversal", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const navigation = new TestNavigationApi();
      yield* listen(navigation);
      const readTypes = vi.fn(() => "docs-next");
      const pending = makeNavigationEvent({
        navigationType: "traverse",
        sourceElement: new TestAnchor({
          get effrontTransitionTypes() {
            return readTypes();
          },
        }),
      });
      navigation.dispatch(pending.event);
      const handler = pending.interception()?.precommitHandler;
      if (Predicate.isNullish(handler)) {
        return yield* Effect.die("Expected a precommit handler.");
      }
      yield* Effect.promise(() => invokePrecommitHandler(handler, makePrecommitController()));
      expect(readTypes).not.toHaveBeenCalled();
      expect(react.transitionTypes).toStrictEqual([
        "navigation",
        "navigation-traverse",
        "navigation-backward",
      ]);
    }),
  ),
);

it.effect("settles the post-commit handler before the Flight stream reaches EOF", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const navigation = new TestNavigationApi();
      let responseController: ReadableStreamDefaultController<Uint8Array> | undefined;
      const httpClient = HttpClient.make((request) =>
        Effect.sync(() =>
          HttpClientResponse.fromWeb(
            request,
            new Response(
              new ReadableStream<Uint8Array>({
                start(controller) {
                  responseController = controller;
                  controller.enqueue(new Uint8Array([1]));
                },
              }),
              {
                headers: {
                  "content-type": "text/x-component",
                },
              },
            ),
          ),
        ),
      );
      yield* listen(navigation, { httpClient, renderer: makeBrowserRenderer() });
      const pendingNavigation = makeNavigationEvent();

      navigation.dispatch(pendingNavigation.event);

      const interception = pendingNavigation.interception();
      const precommitHandler = interception?.precommitHandler;
      if (Predicate.isNullish(precommitHandler)) {
        return yield* Effect.die("Expected a precommit handler.");
      }

      const handlers: NavigationInterceptHandler[] = [];
      yield* Effect.promise(() =>
        invokePrecommitHandler(precommitHandler, makePrecommitController([], handlers)),
      );
      const handler = handlers[0];
      if (Predicate.isNullish(handler)) {
        return yield* Effect.die("Expected a post-commit handler.");
      }
      let handlerSettled = false;
      const navigationFinished = invokeNavigationHandler(handler).then(() => {
        handlerSettled = true;
      });
      yield* Effect.promise(() => Promise.resolve());

      expect(handlerSettled).toBe(true);
      if (Predicate.isNullish(responseController)) {
        return yield* Effect.die("Expected a streaming Flight response.");
      }
      responseController.close();
      yield* Effect.promise(() => navigationFinished);
      expect(handlerSettled).toBe(true);
    }),
  ),
);

it.effect("uses a post-commit handler for a non-cancelable traversal", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const navigation = new TestNavigationApi();
      const requestedUrls: string[] = [];
      yield* listen(navigation, {
        httpClient: makeHttpClient(requestedUrls),
        renderer: makeBrowserRenderer(),
      });
      const pendingNavigation = makeNavigationEvent({
        cancelable: false,
        navigationType: "traverse",
      });

      navigation.dispatch(pendingNavigation.event);

      const interception = pendingNavigation.interception();
      expect(interception?.precommitHandler).toBeUndefined();
      expect(interception?.handler).toBeTypeOf("function");
      const handler = interception?.handler;
      if (Predicate.isNullish(handler)) {
        return yield* Effect.die("Expected a post-commit handler.");
      }

      yield* Effect.promise(() => invokeNavigationHandler(handler));

      expect(requestedUrls).toStrictEqual(["https://effront.test/schedule/day-two"]);
    }),
  ),
);

it.effect("reloads after a non-cancelable traversal fails to load Flight", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const navigation = new TestNavigationApi();
      const reloadDocument = vi.fn();
      yield* listen(navigation, {
        documentReplacements: [],
        httpClient: makeInvalidFlightClient(),
        reloadDocument,
        renderer: makeBrowserRenderer(),
      });
      const pendingNavigation = makeNavigationEvent({
        cancelable: false,
        navigationType: "traverse",
      });

      navigation.dispatch(pendingNavigation.event);

      const handler = pendingNavigation.interception()?.handler;
      if (Predicate.isNullish(handler)) {
        return yield* Effect.die("Expected a post-commit handler.");
      }
      yield* Effect.promise(() => invokeNavigationHandler(handler));

      expect(reloadDocument).toHaveBeenCalledOnce();
    }),
  ),
);

it.effect("does not reload a superseded non-cancelable traversal", () => {
  const navigationAbort = new AbortController();
  navigationAbort.abort();
  return Effect.scoped(
    Effect.gen(function* () {
      const navigation = new TestNavigationApi();
      const reloadDocument = vi.fn();
      yield* listen(navigation, {
        documentReplacements: [],
        httpClient: makeInvalidFlightClient(),
        reloadDocument,
        renderer: makeBrowserRenderer(),
      });
      const pendingNavigation = makeNavigationEvent({
        cancelable: false,
        navigationType: "traverse",
        signal: navigationAbort.signal,
      });

      navigation.dispatch(pendingNavigation.event);

      const handler = pendingNavigation.interception()?.handler;
      if (Predicate.isNullish(handler)) {
        return yield* Effect.die("Expected a post-commit handler.");
      }
      yield* Effect.promise(() => invokeNavigationHandler(handler));

      expect(reloadDocument).not.toHaveBeenCalled();
    }),
  );
});

it.effect("coordinates cache identity across Flight and history commit ordering", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const navigation = new TestNavigationApi();
      const dayTwoUrl = "https://effront.test/schedule/day-two";
      const dayThreeUrl = "https://effront.test/schedule/day-three";
      const dayFourUrl = "https://effront.test/schedule/day-four";
      const dayFiveUrl = "https://effront.test/schedule/day-five";
      const dayTwo = yield* makeControlledRoute(dayTwoUrl);
      const dayThree = yield* makeControlledRoute(dayThreeUrl);
      const dayFour = yield* makeControlledRoute(dayFourUrl);
      const dayFive = yield* makeControlledRoute(dayFiveUrl);
      const routes = new Map([
        [dayTwoUrl, dayTwo.resource],
        [dayThreeUrl, dayThree.resource],
        [dayFourUrl, dayFour.resource],
        [dayFiveUrl, dayFive.resource],
      ]);
      const installed = yield* Deferred.make<void>();
      const servicesLayer = Layer.mergeAll(
        BrowserEffectRunner.layer,
        BrowserRenderer.layerTest(makeBrowserRenderer()),
        makeNavigationApiLayer(navigation),
        RouteLoader.layerTest({
          invalidate: () => undefined,
          load: ({ destination }) => {
            const resource = routes.get(destination.url);
            return Predicate.isNullish(resource)
              ? Effect.die(new TypeError(`Unexpected route ${destination.url}.`))
              : Effect.succeed(resource);
          },
          loadInitial: Effect.die(new TypeError("Unexpected initial route load.")),
          prepareRefresh: () => () => undefined,
        }),
      ).pipe(Layer.provideMerge(Layer.succeed(HttpClient.HttpClient, makeHttpClient())));
      const routerLayer = Layer.effectDiscard(
        installClientRouter.pipe(Effect.andThen(Deferred.succeed(installed, undefined))),
      ).pipe(Layer.provideMerge(servicesLayer));
      const running = yield* Layer.launch(routerLayer).pipe(Effect.forkScoped);
      yield* Effect.raceFirst(Deferred.await(installed), Fiber.join(running));

      const dayTwoHistory = yield* prepareNavigation(navigation, dayTwoUrl);
      yield* Deferred.succeed(dayTwo.completed, undefined);
      yield* Effect.promise(() => dayTwo.released.promise);
      expect(dayTwo.cachedEntries).toStrictEqual([]);

      const dayTwoEntry = makeNavigationEntry("day-two", dayTwoUrl);
      navigation.currentEntry = dayTwoEntry;
      yield* Effect.promise(() => invokeNavigationHandler(dayTwoHistory));
      expect(dayTwo.cachedEntries).toStrictEqual([dayTwoEntry]);

      const dayThreeHistory = yield* prepareNavigation(navigation, dayThreeUrl);
      const dayThreeEntry = makeNavigationEntry("day-three", dayThreeUrl);
      navigation.currentEntry = dayThreeEntry;
      yield* Effect.promise(() => invokeNavigationHandler(dayThreeHistory));
      expect(dayThree.cachedEntries).toStrictEqual([]);

      navigation.currentEntry = makeNavigationEntry("unrelated", dayFiveUrl);
      yield* Deferred.succeed(dayThree.completed, undefined);
      yield* Effect.promise(() => dayThree.released.promise);
      expect(dayThree.cachedEntries).toStrictEqual([dayThreeEntry]);

      const dayFourHistory = yield* prepareNavigation(navigation, dayFourUrl);
      const dayFourEntry = makeNavigationEntry("day-four", dayFourUrl);
      navigation.currentEntry = dayFourEntry;
      yield* Effect.promise(() => invokeNavigationHandler(dayFourHistory));

      yield* prepareNavigation(navigation, dayFiveUrl);
      yield* Effect.promise(() => dayFour.released.promise);
      yield* Deferred.succeed(dayFour.completed, undefined);
      yield* Effect.yieldNow;
      expect(dayFour.cachedEntries).toStrictEqual([]);
    }),
  ),
);

it.effect("reuses completed route trees for back and forward traversals", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const navigation = new TestNavigationApi();
      const dayOneEntry = navigation.currentEntry;
      const dayTwoEntry = makeNavigationEntry("day-two", "https://effront.test/schedule/day-two");
      const requestedUrls: string[] = [];
      const renders: BrowserRenderRequest[] = [];
      yield* listen(navigation, {
        httpClient: makeHttpClient(requestedUrls),
        renderer: makeBrowserRenderer(renders),
      });
      yield* Effect.yieldNow;

      const push = makeNavigationEvent();
      navigation.dispatch(push.event);
      const pushPrecommit = push.interception()?.precommitHandler;
      if (Predicate.isNullish(pushPrecommit)) {
        return yield* Effect.die("Expected a push precommit handler.");
      }
      const pushHandlers: NavigationInterceptHandler[] = [];
      yield* Effect.promise(() =>
        invokePrecommitHandler(pushPrecommit, makePrecommitController([], pushHandlers)),
      );
      navigation.currentEntry = dayTwoEntry;
      const pushHandler = pushHandlers[0];
      if (Predicate.isNullish(pushHandler)) {
        return yield* Effect.die("Expected a push post-commit handler.");
      }
      yield* Effect.promise(() => invokeNavigationHandler(pushHandler));

      const back = makeNavigationEvent({
        destination: { key: dayOneEntry.key, url: dayOneEntry.url },
        navigationType: "traverse",
      });
      navigation.dispatch(back.event);
      const backPrecommit = back.interception()?.precommitHandler;
      if (Predicate.isNullish(backPrecommit)) {
        return yield* Effect.die("Expected a back precommit handler.");
      }
      const backHandlers: NavigationInterceptHandler[] = [];
      yield* Effect.promise(() =>
        invokePrecommitHandler(backPrecommit, makePrecommitController([], backHandlers)),
      );
      navigation.currentEntry = dayOneEntry;
      const backHandler = backHandlers[0];
      if (Predicate.isNullish(backHandler)) {
        return yield* Effect.die("Expected a back post-commit handler.");
      }
      yield* Effect.promise(() => invokeNavigationHandler(backHandler));

      const forward = makeNavigationEvent({
        destination: { key: dayTwoEntry.key, url: dayTwoEntry.url },
        navigationType: "traverse",
      });
      navigation.dispatch(forward.event);
      const forwardPrecommit = forward.interception()?.precommitHandler;
      if (Predicate.isNullish(forwardPrecommit)) {
        return yield* Effect.die("Expected a forward precommit handler.");
      }
      const forwardHandlers: NavigationInterceptHandler[] = [];
      yield* Effect.promise(() =>
        invokePrecommitHandler(forwardPrecommit, makePrecommitController([], forwardHandlers)),
      );
      navigation.currentEntry = dayTwoEntry;
      const forwardHandler = forwardHandlers[0];
      if (Predicate.isNullish(forwardHandler)) {
        return yield* Effect.die("Expected a forward post-commit handler.");
      }
      yield* Effect.promise(() => invokeNavigationHandler(forwardHandler));

      expect(requestedUrls).toStrictEqual(["https://effront.test/schedule/day-two"]);
      expect(renders.map((render) => render.routeTree.id)).toStrictEqual([
        "root",
        "day-one",
        "root",
      ]);
    }),
  ),
);

it.effect("promotes a non-Flight response to native document navigation", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const navigation = new TestNavigationApi();
      yield* listen(navigation, {
        httpClient: makeHttpClient([], "text/html"),
        renderer: makeBrowserRenderer(),
      });
      const pendingNavigation = makeNavigationEvent();

      navigation.dispatch(pendingNavigation.event);

      const interception = pendingNavigation.interception();
      const precommitHandler = interception?.precommitHandler;
      if (Predicate.isNullish(precommitHandler)) {
        return yield* Effect.die("Expected a precommit handler.");
      }
      yield* Effect.promise(() =>
        invokePrecommitHandler(precommitHandler, makePrecommitController()),
      );

      expect(navigation.nativeNavigations).toStrictEqual([
        {
          options: { history: "push", info: "effront-native-document" },
          url: "https://effront.test/schedule/day-two",
        },
      ]);
    }),
  ),
);

it.effect("redirects a cancelable navigation before committing its Flight tree", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const navigation = new TestNavigationApi();
      const redirects: Readonly<{
        options: NavigationNavigateOptions | undefined;
        url: string;
      }>[] = [];
      const handlers: NavigationInterceptHandler[] = [];
      const renders: BrowserRenderRequest[] = [];
      yield* listen(navigation, { renderer: makeBrowserRenderer(renders) });
      const pendingNavigation = makeNavigationEvent({
        destination: { url: "https://effront.test/schedule/day-one" },
      });

      navigation.dispatch(pendingNavigation.event);

      const interception = pendingNavigation.interception();
      const precommitHandler = interception?.precommitHandler;
      if (Predicate.isNullish(precommitHandler)) {
        return yield* Effect.die("Expected a precommit handler.");
      }
      yield* Effect.promise(() =>
        invokePrecommitHandler(precommitHandler, makePrecommitController(redirects, handlers)),
      );

      expect(redirects).toStrictEqual([
        {
          options: { history: "auto" },
          url: "https://effront.test/schedule/day-two",
        },
      ]);
      expect(renders).toHaveLength(1);
      expect(handlers).toHaveLength(1);
    }),
  ),
);

it.effect("falls back to document replacement for a redirected traversal", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const navigation = new TestNavigationApi();
      const documentReplacements: string[] = [];
      yield* listen(navigation, {
        documentReplacements,
        httpClient: makeHttpClient(),
        renderer: makeBrowserRenderer(),
      });
      const pendingNavigation = makeNavigationEvent({
        cancelable: false,
        destination: { url: "https://effront.test/schedule/day-one" },
        navigationType: "traverse",
      });

      navigation.dispatch(pendingNavigation.event);

      const interception = pendingNavigation.interception();
      const handler = interception?.handler;
      if (Predicate.isNullish(handler)) {
        return yield* Effect.die("Expected a post-commit handler.");
      }
      yield* Effect.promise(() => invokeNavigationHandler(handler));

      expect(documentReplacements).toStrictEqual(["https://effront.test/schedule/day-two"]);
    }),
  ),
);

it.effect("cancels a streaming Flight response abandoned before React commits", () => {
  const navigationAbort = new AbortController();
  return Effect.scoped(
    Effect.gen(function* () {
      const navigation = new TestNavigationApi();
      const renderStarted = Promise.withResolvers<void>();
      const renderCommitted = Promise.withResolvers<void>();
      const discardCommitted = Promise.withResolvers<void>();
      const discardStarted = Promise.withResolvers<void>();
      let responseSignal: AbortSignal | undefined;
      const browserRenderer = BrowserRenderer.of({
        commit: () => undefined,
        initialize: () => undefined,
        navigate: () => {
          renderStarted.resolve();
          return {
            committed: renderCommitted.promise,
            discard: () => {
              discardStarted.resolve();
              return discardCommitted.promise;
            },
            retired: Promise.resolve(),
          };
        },
        refresh: () => {
          throw new TypeError("Unexpected refresh.");
        },
      });
      const httpClient = HttpClient.make((request, _url, signal) =>
        Effect.sync(() => {
          responseSignal = signal;
          return HttpClientResponse.fromWeb(
            request,
            new Response(
              new ReadableStream<Uint8Array>({
                start(controller) {
                  controller.enqueue(new Uint8Array([1]));
                  signal.addEventListener(
                    "abort",
                    () => {
                      controller.error(signal.reason);
                    },
                    {
                      once: true,
                    },
                  );
                },
              }),
              {
                headers: {
                  "content-type": "text/x-component",
                },
              },
            ),
          );
        }),
      );
      yield* listen(navigation, { httpClient, renderer: browserRenderer });
      const pendingNavigation = makeNavigationEvent({ signal: navigationAbort.signal });

      navigation.dispatch(pendingNavigation.event);

      const interception = pendingNavigation.interception();
      if (interception?.precommitHandler === undefined) {
        return yield* Effect.die("Expected a precommit handler.");
      }
      const navigationFinished = invokePrecommitHandler(
        interception.precommitHandler,
        makePrecommitController(),
      );
      yield* Effect.promise(() => renderStarted.promise);

      expect(responseSignal?.aborted).toBe(false);

      navigationAbort.abort();
      yield* Effect.promise(() => discardStarted.promise);

      expect(responseSignal?.aborted).toBe(false);

      discardCommitted.resolve();
      const exit = yield* Effect.promise(() => navigationFinished).pipe(Effect.exit);

      expect(Exit.isSuccess(exit)).toBe(true);
      expect(responseSignal?.aborted).toBe(true);
    }),
  );
});

it.effect("interrupts a pending Flight load when a newer navigation starts", () => {
  const navigationAbort = new AbortController();
  return Effect.scoped(
    Effect.gen(function* () {
      const navigation = new TestNavigationApi();
      const requestStarted = Promise.withResolvers<void>();
      const responseAborted = Promise.withResolvers<void>();
      const renders: BrowserRenderRequest[] = [];
      const httpClient = HttpClient.make((request, _url, signal) =>
        Effect.sync(() =>
          HttpClientResponse.fromWeb(
            request,
            new Response(
              new ReadableStream<Uint8Array>({
                start(controller) {
                  requestStarted.resolve();
                  signal.addEventListener(
                    "abort",
                    () => {
                      controller.error(signal.reason);
                      responseAborted.resolve();
                    },
                    { once: true },
                  );
                },
              }),
              {
                headers: {
                  "content-type": "text/x-component",
                },
              },
            ),
          ),
        ),
      );
      yield* listen(navigation, { httpClient, renderer: makeBrowserRenderer(renders) });
      const firstNavigation = makeNavigationEvent({ signal: navigationAbort.signal });

      navigation.dispatch(firstNavigation.event);

      const precommitHandler = firstNavigation.interception()?.precommitHandler;
      if (Predicate.isNullish(precommitHandler)) {
        return yield* Effect.die("Expected a precommit handler.");
      }
      const firstNavigationFinished = invokePrecommitHandler(
        precommitHandler,
        makePrecommitController(),
      );
      yield* Effect.promise(() => requestStarted.promise);

      navigation.dispatch(
        makeNavigationEvent({
          destination: { url: "https://effront.test/schedule/day-three" },
        }).event,
      );
      yield* Effect.promise(() => responseAborted.promise);
      yield* Effect.promise(() => firstNavigationFinished);

      expect(navigationAbort.signal.aborted).toBe(false);
      expect(renders).toStrictEqual([]);
    }),
  );
});

it.effect("discards and releases a scheduled candidate when a newer navigation starts", () => {
  const navigationAbort = new AbortController();
  return Effect.scoped(
    Effect.gen(function* () {
      const navigation = new TestNavigationApi();
      const renderStarted = Promise.withResolvers<void>();
      const renderCommitted = Promise.withResolvers<void>();
      const discardCommitted = Promise.withResolvers<void>();
      const discardStarted = Promise.withResolvers<void>();
      const responseAborted = Promise.withResolvers<void>();
      let responseSignal: AbortSignal | undefined;
      const browserRenderer = BrowserRenderer.of({
        commit: () => undefined,
        initialize: () => undefined,
        navigate: () => {
          renderStarted.resolve();
          return {
            committed: renderCommitted.promise,
            discard: () => {
              discardStarted.resolve();
              return discardCommitted.promise;
            },
            retired: Promise.resolve(),
          };
        },
        refresh: () => {
          throw new TypeError("Unexpected refresh.");
        },
      });
      const httpClient = HttpClient.make((request, _url, signal) =>
        Effect.sync(() => {
          responseSignal = signal;
          return HttpClientResponse.fromWeb(
            request,
            new Response(
              new ReadableStream<Uint8Array>({
                start(controller) {
                  controller.enqueue(new Uint8Array([1]));
                  signal.addEventListener(
                    "abort",
                    () => {
                      controller.error(signal.reason);
                      responseAborted.resolve();
                    },
                    { once: true },
                  );
                },
              }),
              {
                headers: {
                  "content-type": "text/x-component",
                },
              },
            ),
          );
        }),
      );
      yield* listen(navigation, { httpClient, renderer: browserRenderer });
      const firstNavigation = makeNavigationEvent({ signal: navigationAbort.signal });

      navigation.dispatch(firstNavigation.event);

      const precommitHandler = firstNavigation.interception()?.precommitHandler;
      if (Predicate.isNullish(precommitHandler)) {
        return yield* Effect.die("Expected a precommit handler.");
      }
      const firstNavigationFinished = invokePrecommitHandler(
        precommitHandler,
        makePrecommitController(),
      );
      yield* Effect.promise(() => renderStarted.promise);

      navigation.dispatch(
        makeNavigationEvent({
          destination: { url: "https://effront.test/schedule/day-three" },
        }).event,
      );
      yield* Effect.promise(() => discardStarted.promise);

      expect(responseSignal?.aborted).toBe(false);

      discardCommitted.resolve();
      yield* Effect.promise(() => responseAborted.promise);

      expect(responseSignal?.aborted).toBe(true);
      expect(navigationAbort.signal.aborted).toBe(false);

      yield* Effect.promise(() => firstNavigationFinished);
    }),
  );
});

it.effect("retains a committed Flight response until its render retires", () => {
  const navigationAbort = new AbortController();
  return Effect.scoped(
    Effect.gen(function* () {
      const navigation = new TestNavigationApi();
      const renderRetired = Promise.withResolvers<void>();
      const responseAborted = Promise.withResolvers<void>();
      let responseSignal: AbortSignal | undefined;
      const httpClient = HttpClient.make((request, _url, signal) =>
        Effect.sync(() => {
          if (new URL(request.url).pathname === "/schedule/day-three") {
            return HttpClientResponse.fromWeb(
              request,
              new Response(
                new ReadableStream<Uint8Array>({
                  start(controller) {
                    controller.error(new Error("Failed to load the successor."));
                  },
                }),
                {
                  headers: {
                    "content-type": "text/x-component",
                  },
                },
              ),
            );
          }
          responseSignal = signal;
          return HttpClientResponse.fromWeb(
            request,
            new Response(
              new ReadableStream<Uint8Array>({
                start(controller) {
                  controller.enqueue(new Uint8Array([1]));
                  signal.addEventListener(
                    "abort",
                    () => {
                      controller.error(signal.reason);
                      responseAborted.resolve();
                    },
                    { once: true },
                  );
                },
              }),
              {
                headers: {
                  "content-type": "text/x-component",
                },
              },
            ),
          );
        }),
      );
      const browserRenderer = BrowserRenderer.of({
        commit: () => undefined,
        initialize: () => undefined,
        navigate: () => ({
          committed: Promise.resolve(),
          discard: () => Promise.resolve(),
          retired: renderRetired.promise,
        }),
        refresh: () => {
          throw new TypeError("Unexpected refresh.");
        },
      });
      yield* listen(navigation, { httpClient, renderer: browserRenderer });
      const pendingNavigation = makeNavigationEvent({ signal: navigationAbort.signal });

      navigation.dispatch(pendingNavigation.event);

      const interception = pendingNavigation.interception();
      const precommitHandler = interception?.precommitHandler;
      if (Predicate.isNullish(precommitHandler)) {
        return yield* Effect.die("Expected a precommit handler.");
      }
      const handlers: NavigationInterceptHandler[] = [];
      yield* Effect.promise(() =>
        invokePrecommitHandler(precommitHandler, makePrecommitController([], handlers)),
      );
      navigation.currentEntry = makeNavigationEntry(
        "day-two",
        "https://effront.test/schedule/day-two",
      );
      const handler = handlers[0];
      if (Predicate.isNullish(handler)) {
        return yield* Effect.die("Expected a post-commit handler.");
      }
      yield* Effect.promise(() => invokeNavigationHandler(handler));

      expect(responseSignal?.aborted).toBe(false);

      navigationAbort.abort();
      yield* Effect.yieldNow;

      expect(responseSignal?.aborted).toBe(false);

      const failedNavigation = makeNavigationEvent({
        destination: { url: "https://effront.test/schedule/day-three" },
      });
      navigation.dispatch(failedNavigation.event);
      const failedPrecommitHandler = failedNavigation.interception()?.precommitHandler;
      if (Predicate.isNullish(failedPrecommitHandler)) {
        return yield* Effect.die("Expected a precommit handler for the failed successor.");
      }
      const failed = yield* Effect.exit(
        Effect.promise(() =>
          invokePrecommitHandler(failedPrecommitHandler, makePrecommitController()),
        ),
      );

      expect(Exit.isFailure(failed)).toBe(true);
      expect(responseSignal?.aborted).toBe(false);

      renderRetired.resolve();
      yield* Effect.promise(() => responseAborted.promise);

      expect(responseSignal?.aborted).toBe(true);
    }),
  );
});

it.effect("leaves navigations outside the router boundary to the browser", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const navigation = new TestNavigationApi();
      const requestedUrls: string[] = [];
      yield* listen(navigation, {
        httpClient: makeHttpClient(requestedUrls),
        renderer: makeBrowserRenderer(),
      });
      const nativeNavigations = [
        makeNavigationEvent({ canIntercept: false }),
        makeNavigationEvent({ hashChange: true }),
        makeNavigationEvent({ downloadRequest: "" }),
        makeNavigationEvent({ formData: new FormData() }),
        makeNavigationEvent({ info: "react-transition" }),
        makeNavigationEvent({ info: "effront-native-document" }),
        makeNavigationEvent({ navigationType: "reload" }),
      ];

      for (const navigationEvent of nativeNavigations) {
        navigation.dispatch(navigationEvent.event);
        expect(navigationEvent.interception()).toBeNull();
      }
      expect(requestedUrls).toStrictEqual([]);
    }),
  ),
);

it.effect("removes the listener when its Effect scope closes", () =>
  Effect.gen(function* () {
    const navigation = new TestNavigationApi();
    const scope = yield* Scope.make();
    yield* listen(navigation).pipe(Scope.provide(scope));

    expect(navigation.isListening).toBe(true);

    yield* Scope.close(scope, Exit.void);

    expect(navigation.isListening).toBe(false);
  }),
);

it.effect(
  "releases the previous navigation stream when the real renderer commits its successor",
  () =>
    Effect.scoped(
      Effect.gen(function* () {
        const navigation = new TestNavigationApi();
        const renderer = yield* BrowserRenderer.make;
        let published = Promise.withResolvers<BrowserRender>();
        renderer.initialize(initialRouteTree, (render) => {
          published.resolve(render);
        });
        const { httpClient, responseSignals } = makeStreamingHttpClient();
        yield* listen(navigation, { httpClient, renderer });

        const firstUrl = "https://effront.test/schedule/day-two";
        const firstPreparation = yield* prepareNavigation(navigation, firstUrl).pipe(
          Effect.forkChild,
        );
        const firstRender = yield* Effect.promise(() => published.promise);
        yield* Effect.yieldNow;
        renderer.commit(firstRender);
        const firstHistory = yield* Fiber.join(firstPreparation);
        navigation.currentEntry = makeNavigationEntry("day-two", firstUrl);
        yield* Effect.promise(() => invokeNavigationHandler(firstHistory));

        published = Promise.withResolvers<BrowserRender>();
        const secondPreparation = yield* prepareNavigation(
          navigation,
          "https://effront.test/schedule/day-three",
        ).pipe(Effect.forkChild);
        const secondRender = yield* Effect.promise(() => published.promise);
        yield* Effect.yieldNow;
        expect(responseSignals[0]?.aborted).toBe(false);

        // Both router observers are waiting when React commits the successor.
        // The old stream must close even if the new generation becomes current first.
        renderer.commit(secondRender);
        yield* Fiber.join(secondPreparation);
        yield* Effect.yieldNow;
        expect(responseSignals[0]?.aborted).toBe(true);
        expect(responseSignals[1]?.aborted).toBe(false);
      }),
    ),
);

it.effect(
  "keeps a committed navigation stream alive when superseded before its commit notification",
  () =>
    Effect.scoped(
      Effect.gen(function* () {
        const navigation = new TestNavigationApi();
        const renderer = yield* BrowserRenderer.make;
        let published = Promise.withResolvers<BrowserRender>();
        renderer.initialize(initialRouteTree, (render) => {
          published.resolve(render);
        });
        const { httpClient, responseSignals } = makeStreamingHttpClient();
        yield* listen(navigation, { httpClient, renderer });

        const first = makeNavigationEvent();
        navigation.dispatch(first.event);
        const firstHandler = first.interception()?.precommitHandler;
        if (Predicate.isNullish(firstHandler)) {
          return yield* Effect.die("Expected a precommit handler for the first navigation.");
        }
        const firstPreparation = yield* Effect.promise(() =>
          invokePrecommitHandler(firstHandler, makePrecommitController()),
        ).pipe(Effect.forkChild);
        const firstRender = yield* Effect.promise(() => published.promise);
        yield* Effect.yieldNow;

        const successor = makeNavigationEvent({
          destination: { url: "https://effront.test/schedule/day-three" },
        });
        // A child layout effect can queue navigation before the root resolves committed.
        // That microtask then runs before the router processes the commit notification.
        queueMicrotask(() => {
          navigation.dispatch(successor.event);
        });
        renderer.commit(firstRender);
        yield* Fiber.join(firstPreparation);
        yield* Effect.yieldNow;

        expect(responseSignals).toHaveLength(1);
        expect(responseSignals[0]?.aborted).toBe(false);

        const successorHandler = successor.interception()?.precommitHandler;
        if (Predicate.isNullish(successorHandler)) {
          return yield* Effect.die("Expected a precommit handler for the successor.");
        }
        published = Promise.withResolvers<BrowserRender>();
        const successorPreparation = yield* Effect.promise(() =>
          invokePrecommitHandler(successorHandler, makePrecommitController()),
        ).pipe(Effect.forkChild);
        const successorRender = yield* Effect.promise(() => published.promise);
        expect(responseSignals[0]?.aborted).toBe(false);

        renderer.commit(successorRender);
        yield* Fiber.join(successorPreparation);
        yield* Effect.yieldNow;
        expect(responseSignals[0]?.aborted).toBe(true);
        expect(responseSignals[1]?.aborted).toBe(false);
      }),
    ),
);

it.effect("keeps an older navigation stream while a queued discard can restore it", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const navigation = new TestNavigationApi();
      const renderer = yield* BrowserRenderer.make;
      let published = Promise.withResolvers<BrowserRender>();
      renderer.initialize(initialRouteTree, (render) => {
        published.resolve(render);
      });
      const { httpClient, responseSignals } = makeStreamingHttpClient();
      yield* listen(navigation, { httpClient, renderer });

      const firstUrl = "https://effront.test/schedule/day-two";
      const firstPreparation = yield* prepareNavigation(navigation, firstUrl).pipe(
        Effect.forkChild,
      );
      const firstRender = yield* Effect.promise(() => published.promise);
      yield* Effect.yieldNow;
      renderer.commit(firstRender);
      const firstHistory = yield* Fiber.join(firstPreparation);
      navigation.currentEntry = makeNavigationEntry("day-two", firstUrl);
      yield* Effect.promise(() => invokeNavigationHandler(firstHistory));

      published = Promise.withResolvers<BrowserRender>();
      const secondUrl = "https://effront.test/schedule/day-three";
      const secondPreparation = yield* prepareNavigation(navigation, secondUrl).pipe(
        Effect.forkChild,
      );
      const secondRender = yield* Effect.promise(() => published.promise);
      yield* Effect.yieldNow;

      // A cancelled refresh queues restoration of the first page before the second commits.
      const refresh = renderer.refresh(initialRouteTree);
      published = Promise.withResolvers<BrowserRender>();
      const discarded = refresh.discard();
      const discardRender = yield* Effect.promise(() => published.promise);
      renderer.commit(secondRender);
      const secondHistory = yield* Fiber.join(secondPreparation);
      navigation.currentEntry = makeNavigationEntry("day-three", secondUrl);
      yield* Effect.promise(() => invokeNavigationHandler(secondHistory));
      expect(responseSignals[0]?.aborted).toBe(false);
      expect(responseSignals[1]?.aborted).toBe(false);

      // The router has moved on, but React can still restore the first page.
      renderer.commit(discardRender);
      yield* Effect.promise(() => discarded);
      yield* Effect.yieldNow;
      expect(responseSignals[0]?.aborted).toBe(false);
      expect(responseSignals[1]?.aborted).toBe(true);

      // Once the restored page retires, its original observer must release its stream.
      published = Promise.withResolvers<BrowserRender>();
      renderer.refresh(initialRouteTree);
      const replacement = yield* Effect.promise(() => published.promise);
      renderer.commit(replacement);
      yield* Effect.yieldNow;
      expect(responseSignals[0]?.aborted).toBe(true);
    }),
  ),
);
