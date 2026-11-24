import { Deferred, Effect, Exit, Fiber, Function, Layer } from "effect";
import { HttpClient } from "effect/http";

import { BrowserEffectRunner } from "#core/client/browser-effect-runner.ts";
import { BrowserRenderer } from "#core/client/browser-renderer.ts";
import { installClientRouter } from "#core/client/client-router.ts";
import { RouteLoader } from "#core/client/route-loader.ts";
import { navigationFlightLayer } from "./client-routing-flight.fixture.ts";
import { makeHttpClient } from "./client-routing-http.fixture.ts";
import { makeNavigationApiLayer } from "./client-routing-navigation.fixture.ts";
import type { TestNavigationApi } from "./client-routing-navigation.fixture.ts";
import { makeBrowserRenderer } from "./client-routing-renderer.fixture.ts";

type ListenerOptions = Readonly<{
  documentReplacements?: string[];
  httpClient?: HttpClient.HttpClient;
  reloadDocument?: () => void;
  renderer?: typeof BrowserRenderer.Service;
}>;

type Completed = Effect.Success<typeof Effect.void>;

export const listen = Effect.fn("effront.test.listenToNavigation")(function* (
  navigation: TestNavigationApi,
  {
    documentReplacements = [],
    httpClient = makeHttpClient(),
    reloadDocument = Function.constVoid,
    renderer = makeBrowserRenderer(),
  }: ListenerOptions = {},
) {
  const installed = yield* Deferred.make<Completed>();
  const navigationLayer = makeNavigationApiLayer(navigation, documentReplacements, reloadDocument);
  const routeLoaderLayer = RouteLoader.layer.pipe(
    Layer.provide(navigationFlightLayer),
    Layer.provide(navigationLayer),
  );
  const services = Layer.mergeAll(
    BrowserEffectRunner.layer,
    BrowserRenderer.layerTest(renderer),
    navigationLayer,
    routeLoaderLayer,
  ).pipe(Layer.provideMerge(Layer.succeed(HttpClient.HttpClient, httpClient)));
  const router = Layer.effectDiscard(
    Effect.gen(function* () {
      const routeLoader = yield* RouteLoader;
      yield* routeLoader.loadInitial;
      yield* installClientRouter;
      yield* Deferred.done(installed, Exit.void);
    }),
  ).pipe(Layer.provideMerge(services));
  const running = yield* Layer.launch(router).pipe(Effect.forkScoped);
  yield* Effect.raceFirst(Deferred.await(installed), Fiber.join(running));
});
