import { Effect, MutableRef } from "effect";

import { BrowserEffectRunner } from "./browser-effect-runner.ts";
import { BrowserRenderer } from "./browser-renderer.ts";
import { NavigationApi } from "./navigation-api.ts";
import { makeNavigateListener } from "./navigation-events.ts";
import type { NavigationContext } from "./navigation-request.ts";
import { initialRouterState } from "./navigation-router-model.ts";
import { reduceRouterState } from "./navigation-router-reducer.ts";
import { RouteLoader } from "./route-loader.ts";

export const installClientRouter = Effect.gen(function* () {
  const renderer = yield* BrowserRenderer;
  const navigation = yield* NavigationApi;
  const routeLoader = yield* RouteLoader;
  const run = yield* BrowserEffectRunner;
  const state = MutableRef.make(initialRouterState());
  const context: NavigationContext = {
    dispatch: (event) => {
      const transition = reduceRouterState(MutableRef.get(state), event);
      MutableRef.set(state, transition.state);
      return transition;
    },
    navigation,
    renderer,
    routeLoader,
    run,
  };
  const onNavigate = makeNavigateListener(context);
  yield* Effect.acquireRelease(
    Effect.sync(() => navigation.subscribe(onNavigate)),
    Effect.sync,
  );
});
