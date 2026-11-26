import { Effect, Fiber, MutableRef } from "effect";

import { BrowserRenderer } from "#core/client/browser-renderer.ts";
import type { BrowserRender } from "#core/client/browser-renderer.ts";
import { observePromise } from "./client-routing-candidate.fixture.ts";
import { invokeNavigationHandler, prepareNavigation } from "./client-routing-commit.fixture.ts";
import { nativeNavigationGlobals } from "./client-routing-events.fixture.ts";
import { makeStreamingHttpClient } from "./client-routing-http.fixture.ts";
import { makeNavigationEntry, TestNavigationApi } from "./client-routing-navigation.fixture.ts";
import { initialRouteTree } from "./client-routing-renderer.fixture.ts";
import { listen } from "./client-routing-router.fixture.ts";

export const firstUrl = "https://effront.test/schedule/day-two";
export const nextUrl = "https://effront.test/schedule/day-three";

export const openLiveRenderer = Effect.gen(function* () {
  yield* nativeNavigationGlobals;
  const navigation = new TestNavigationApi();
  const renderer = yield* BrowserRenderer.make;
  const publication = MutableRef.make(Promise.withResolvers<BrowserRender>());
  renderer.initialize(initialRouteTree, (render) => {
    MutableRef.get(publication).resolve(render);
  });
  const { httpClient, responseSignals } = makeStreamingHttpClient();
  yield* listen(navigation, { httpClient, renderer });
  return {
    navigation,
    read: (): Effect.Effect<BrowserRender> => observePromise(MutableRef.get(publication).promise),
    renderer,
    reset: (): void => {
      MutableRef.set(publication, Promise.withResolvers<BrowserRender>());
    },
    responseSignals,
  };
});

export type LiveRenderer = Effect.Success<typeof openLiveRenderer>;
export type History = ReturnType<typeof makeNavigationEntry>;

export const prepareRender = Effect.fnUntraced(function* (fixture: LiveRenderer, url: string) {
  const preparation = yield* prepareNavigation(fixture.navigation, url).pipe(Effect.forkChild);
  const render = yield* fixture.read();
  yield* Effect.yieldNow;
  return { preparation, render };
});

type Prepared = Effect.Success<ReturnType<typeof prepareRender>>;

export const commitHistory = Effect.fnUntraced(function* (
  navigation: TestNavigationApi,
  { preparation }: Prepared,
  entry: History,
) {
  const history = yield* Fiber.join(preparation);
  navigation.currentEntry = entry;
  yield* observePromise(invokeNavigationHandler(history));
});

export const committedFirstPage = Effect.fnUntraced(function* (fixture: LiveRenderer) {
  const prepared = yield* prepareRender(fixture, firstUrl);
  fixture.renderer.commit(prepared.render);
  yield* commitHistory(fixture.navigation, prepared, makeNavigationEntry("day-two", firstUrl));
  fixture.reset();
});
