import { Predicate, Effect, Layer } from "effect";

import { navigationMode } from "./browser-capabilities.ts";
import { BrowserEffectRunner } from "./browser-effect-runner.ts";
import { withBrowserServices } from "./browser-layer.ts";
import { showBrowserFailure } from "./browser-screen.tsx";
import { installCallServer } from "./call-server.ts";
import { installClientRouter } from "./client-router.ts";
import { ReactDOMRenderer } from "./react-dom-renderer.tsx";
import { RouteLoader } from "./route-loader.ts";
import { installRouteRefresh, RouteRefresher } from "./route-refresh.ts";

const BrowserLayer = Layer.mergeAll(
  ReactDOMRenderer.layer,
  RouteLoader.layer,
  RouteRefresher.layer,
).pipe(withBrowserServices);

const renderBrowserFailure = Effect.sync(showBrowserFailure);

const activateBrowser = Effect.gen(function* () {
  const routeLoader = yield* RouteLoader;
  const reactDOMRenderer = yield* ReactDOMRenderer;

  const initialPayload = yield* routeLoader.loadInitial;
  yield* reactDOMRenderer.hydrate(document, initialPayload);
  yield* installRouteRefresh;
  yield* installCallServer;
  const mode = yield* navigationMode;
  if (mode === "Client") {
    yield* installClientRouter;
  }
});

const installViteHmr = Effect.gen(function* () {
  // oxlint-disable-next-line eslint/prefer-destructuring -- Vite detects the literal import.meta.hot access when injecting its HMR context.
  const hot = (
    import.meta as ImportMeta &
      Readonly<{
        hot?: {
          on: (event: string, listener: () => void) => void;
          off: (event: string, listener: () => void) => void;
        };
      }>
  ).hot;
  if (Predicate.isNullish(hot)) {
    return;
  }

  const run = yield* BrowserEffectRunner;
  const routeRefresher = yield* RouteRefresher;
  const refresh = (): void => {
    // oxlint-disable-next-line typescript/no-floating-promises -- Vite delivers updates synchronously. The browser scope owns this refresh.
    run(routeRefresher.refreshCurrentRoute("hmr-refresh"));
  };
  hot.on("rsc:update", refresh);
  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      hot.off("rsc:update", refresh);
    }),
  );
});

export const browserMain = Effect.scoped(
  Effect.gen(function* () {
    yield* activateBrowser;
    yield* installViteHmr;
    return yield* Effect.never;
  }).pipe(
    Effect.catchTags({
      FlightLoadError: () => renderBrowserFailure,
      ReactDOMHydrationError: () => renderBrowserFailure,
    }),
  ),
).pipe(Effect.provide(BrowserLayer));
