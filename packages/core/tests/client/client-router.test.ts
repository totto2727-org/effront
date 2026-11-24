// oxlint-disable-next-line import/no-unassigned-import -- Vitest registers the browser decoder fixture before loading the navigation runtime.
import "./client-routing-rsc.fixture.ts";

import { afterEach, beforeEach, expect, it } from "@effect/vitest";
import { Predicate, Effect, Exit, Fiber } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { vi } from "vitest";

import { BrowserRenderer } from "#core/client/browser-renderer.ts";
import type { BrowserRender } from "#core/client/browser-renderer.ts";

import { makeNavigationEvent, TestAnchor } from "./client-routing-events.fixture.ts";
import { makeNavigationEntry, TestNavigationApi } from "./client-routing-navigation.fixture.ts";

import { makeStreamingHttpClient } from "./client-routing-http.fixture.ts";
import { initialRouteTree, makeBrowserRenderer } from "./client-routing-renderer.fixture.ts";
import type { BrowserRenderRequest } from "./client-routing-renderer.fixture.ts";

import {
  invokeNavigationHandler,
  invokePrecommitHandler,
  makePrecommitController,
  prepareNavigation,
} from "./client-routing-commit.fixture.ts";
import { listen } from "./client-routing-router.fixture.ts";

beforeEach(() => {
  vi.stubGlobal("HTMLAnchorElement", TestAnchor);
});

afterEach(() => vi.unstubAllGlobals());

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
