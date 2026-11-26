import { Array, Effect, MutableRef, Option } from "effect";
import { addTransitionType, startTransition } from "react";

import type { BrowserRendererNavigation } from "./browser-renderer.ts";
import type { NavigationContext, NavigationRequest } from "./navigation-request.ts";
import { getNavigationTransitionTypes } from "./navigation-transition-types.ts";
import type { RouteResource } from "./route-loader.ts";

type PublicationContext = Pick<NavigationContext, "navigation" | "renderer">;
type PublicationRequest = Pick<NavigationRequest, "event" | "linkTransitionTypes">;

export const publishNavigation = (
  { navigation, renderer }: PublicationContext,
  { event, linkTransitionTypes }: PublicationRequest,
  resource: RouteResource,
): Effect.Effect<BrowserRendererNavigation> =>
  Effect.sync(() => {
    const current = MutableRef.make(Option.none<BrowserRendererNavigation>());
    startTransition(() => {
      const fromIndex =
        navigation.getTransition()?.from.index ?? navigation.getCurrentEntry()?.index;
      Array.forEach(getNavigationTransitionTypes(event, fromIndex), addTransitionType);
      Array.forEach(linkTransitionTypes, addTransitionType);
      MutableRef.set(current, Option.some(renderer.navigate(resource.routeTree)));
    });
    return Option.getOrThrow(MutableRef.get(current));
  });
