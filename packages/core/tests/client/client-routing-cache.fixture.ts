import { Deferred, Effect, Exit, Fiber, Function, Layer, Predicate } from "effect";
import { HttpClient } from "effect/http";

import { BrowserEffectRunner } from "#core/client/browser-effect-runner.ts";
import { BrowserRenderer } from "#core/client/browser-renderer.ts";
import { installClientRouter } from "#core/client/client-router.ts";
import { RouteLoader } from "#core/client/route-loader.ts";
import type { RouteResource } from "#core/client/route-loader.ts";
import { makeControlledRoute } from "./client-routing-flight.fixture.ts";
import { makeHttpClient } from "./client-routing-http.fixture.ts";
import { makeNavigationApiLayer } from "./client-routing-navigation.fixture.ts";
import type { TestNavigationApi } from "./client-routing-navigation.fixture.ts";
import { makeBrowserRenderer } from "./client-routing-renderer.fixture.ts";

type Routes = ReadonlyMap<string, RouteResource>;
type Completed = Effect.Success<typeof Effect.void>;

const routeLoader = (routes: Routes): Layer.Layer<RouteLoader> =>
  RouteLoader.layerTest({
    invalidate: Function.constVoid,
    load: ({ destination }) => {
      const found = routes.get(destination.url);
      return Predicate.isNullish(found)
        ? Effect.die(`Unexpected route ${destination.url}.`)
        : Effect.succeed(found);
    },
    loadInitial: Effect.die("Unexpected initial route load."),
    prepareRefresh: () => Function.constVoid,
  });

export const listenToControlledRoutes = Effect.fn("effront.test.listenToControlledRoutes")(
  function* (navigation: TestNavigationApi, routes: Routes) {
    const installed = yield* Deferred.make<Completed>();
    const transport = Layer.succeed(HttpClient.HttpClient, makeHttpClient());
    const services = Layer.mergeAll(
      BrowserEffectRunner.layer,
      BrowserRenderer.layerTest(makeBrowserRenderer()),
      makeNavigationApiLayer(navigation),
      routeLoader(routes),
    ).pipe(Layer.provideMerge(transport));
    const install = installClientRouter.pipe(Effect.andThen(Deferred.done(installed, Exit.void)));
    const router = Layer.effectDiscard(install).pipe(Layer.provideMerge(services));
    const running = yield* Layer.launch(router).pipe(Effect.forkScoped);
    yield* Effect.raceFirst(Deferred.await(installed), Fiber.join(running));
  },
);

export const dayTwoUrl = "https://effront.test/schedule/day-two";
export const dayThreeUrl = "https://effront.test/schedule/day-three";
export const dayFourUrl = "https://effront.test/schedule/day-four";
export const dayFiveUrl = "https://effront.test/schedule/day-five";

export type ControlledFlight = Effect.Success<ReturnType<typeof makeControlledRoute>>;

export const fixtureRoutes = Effect.gen(function* () {
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
  return { dayFour, dayThree, dayTwo, routes };
});
