import { Data } from "effect";

import type { BrowserEffectRunner } from "./browser-effect-runner.ts";
import type { BrowserRenderer, BrowserRendererNavigation } from "./browser-renderer.ts";
import type { NavigationApi } from "./navigation-api.ts";
import type { RouterEvent, RouterTransition } from "./navigation-router-model.ts";
import type { RouteLoader, RouteResource } from "./route-loader.ts";

export type NavigationRequest = Readonly<{
  destination: URL;
  event: NavigateEvent;
  generation: symbol;
  linkTransitionTypes: Readonly<string[]>;
  signal: AbortSignal;
}>;

export type NavigationContext = Readonly<{
  dispatch: (event: RouterEvent) => RouterTransition;
  navigation: typeof NavigationApi.Service;
  renderer: typeof BrowserRenderer.Service;
  routeLoader: typeof RouteLoader.Service;
  run: typeof BrowserEffectRunner.Service;
}>;

// oxlint-disable-next-line typescript/no-generated-empty-object-type -- Effect represents the terminal case without a payload.
type NoPayload = Record<never, never>;

export type NavigationPreparation = Data.TaggedEnum<{
  Handled: NoPayload;
  Rendered: {
    rendererNavigation: BrowserRendererNavigation;
    resolvedDestination: URL;
    resource: RouteResource;
  };
}>;

export const preparations = Data.taggedEnum<NavigationPreparation>();
