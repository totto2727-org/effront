import * as BrowserHttpClient from "@effect/platform-browser/BrowserHttpClient";
import { Effect, Layer } from "effect";

import { navigationMode } from "./browser-capabilities.ts";
import { BrowserEffectRunner } from "./browser-effect-runner.ts";
import { BrowserRenderStatus } from "./browser-render-status.ts";
import { BrowserRenderer } from "./browser-renderer.ts";
import { showBrowserFailure } from "./browser-screen.tsx";
import { installCallServer } from "./call-server.ts";
import { installClientRouter } from "./client-router.ts";
import { FlightClient } from "./flight-client.ts";
import { InitialFlightStream } from "./initial-flight-stream.ts";
import { NavigationApi } from "./navigation-api.ts";
import { ReactDOMRenderer } from "./react-dom-renderer.tsx";
import { RouteLoader } from "./route-loader.ts";
import { installRouteRefresh, RouteRefresher } from "./route-refresh.ts";

const BrowserServicesLayer = Layer.mergeAll(
  BrowserEffectRunner.layer,
  BrowserRenderer.layer,
  BrowserRenderStatus.layer,
  FlightClient.layer,
  NavigationApi.layer,
).pipe(Layer.provide(InitialFlightStream.layer));

const BrowserLayer = Layer.mergeAll(
  ReactDOMRenderer.layer,
  RouteLoader.layer,
  RouteRefresher.layer,
).pipe(Layer.provideMerge(BrowserServicesLayer), Layer.provide(BrowserHttpClient.layerFetch));

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
  const hot = (
    import.meta as ImportMeta & {
      readonly hot?: {
        on: (event: string, listener: () => void) => void;
        off: (event: string, listener: () => void) => void;
      };
    }
  ).hot;
  if (hot === undefined) {
    return;
  }

  const run = yield* BrowserEffectRunner;
  const routeRefresher = yield* RouteRefresher;
  const refresh = () => {
    void run(routeRefresher.refreshCurrentRoute("hmr-refresh"));
  };
  hot.on("rsc:update", refresh);
  yield* Effect.addFinalizer(() => Effect.sync(() => hot.off("rsc:update", refresh)));
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
