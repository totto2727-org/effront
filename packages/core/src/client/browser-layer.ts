import { BrowserHttpClient } from "@effect/platform-browser";
import { Function, Layer } from "effect";

import { BrowserEffectRunner } from "./browser-effect-runner.ts";
import { BrowserRenderer } from "./browser-renderer.ts";
import { BrowserRenderStatus } from "./browser-render-status.ts";
import { FlightClient } from "./flight-client.ts";
import { InitialFlightStream } from "./initial-flight-stream.ts";
import { NavigationApi } from "./navigation-api.ts";

const BrowserServicesLayer = Layer.mergeAll(
  BrowserEffectRunner.layer,
  BrowserRenderer.layer,
  BrowserRenderStatus.layer,
  FlightClient.layer,
  NavigationApi.layer,
).pipe(Layer.provide(InitialFlightStream.layer));

export const withBrowserServices = Function.flow(
  Layer.provideMerge(BrowserServicesLayer),
  Layer.provide(BrowserHttpClient.layerFetch),
);
