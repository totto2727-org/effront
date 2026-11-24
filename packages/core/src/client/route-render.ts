import { Effect, MutableRef, Option } from "effect";
import { addTransitionType, startTransition } from "react";

import type { RouteTreeModel } from "#core/rsc/route-tree.ts";
import type { BrowserRenderer } from "./browser-renderer.ts";

export type RouteRefreshTransitionType = "hmr-refresh" | "server-function";
export type PublishedRefresh = ReturnType<BrowserRenderer["Service"]["refresh"]>;

export const publishRefresh = (
  renderer: BrowserRenderer["Service"],
  routeTree: RouteTreeModel,
  transitionType: RouteRefreshTransitionType,
): Effect.Effect<PublishedRefresh> =>
  Effect.sync(() => {
    const publication = MutableRef.make(Option.none<PublishedRefresh>());
    startTransition(() => {
      addTransitionType(transitionType);
      // React can commit after the Transition Action finishes.
      const rendered = renderer.refresh(routeTree);
      MutableRef.set(publication, Option.some(rendered));
    });
    return Option.getOrThrow(MutableRef.get(publication));
  });
