import { Effect, Predicate } from "effect";

import type { BrowserRendererNavigation } from "./browser-renderer.ts";
import { candidates, navigationInvariant, routerCommands } from "./navigation-router-model.ts";
import type { NavigationCandidate, RouterCommand } from "./navigation-router-model.ts";
import type { RouteResource } from "./route-loader.ts";

type CommandResult = Effect.Effect<void>;

const cacheRoute = (cache: RouteResource["cache"], entry: NavigationHistoryEntry): CommandResult =>
  Effect.sync(() => {
    cache(entry);
  });

const discardRoute = (
  rendererNavigation: BrowserRendererNavigation,
  resource: RouteResource,
): CommandResult => {
  // oxlint-disable-next-line typescript/promise-function-async -- Wait on the exact native retirement promise before releasing Flight.
  const retired = Effect.promise(() => rendererNavigation.discard());
  return Effect.ensuring(retired, resource.release);
};

const supersede = (candidate: NavigationCandidate): CommandResult => {
  const stop = Effect.sync(() => {
    candidate.lifetime.abort();
  });
  const release = Effect.suspend(() =>
    candidates.$match(candidate, {
      Loading: () => Effect.void,
      Publishing: ({ resource }) => resource.release,
      Rendering: ({ rendererNavigation, resource }) => discardRoute(rendererNavigation, resource),
    }),
  );
  return Effect.andThen(stop, release);
};

export const executeRouterCommand = (command: RouterCommand | undefined): CommandResult =>
  Predicate.isNullish(command)
    ? Effect.void
    : routerCommands.$match(command, {
        CacheAndReleaseRoute: ({ entry, resource }) =>
          Effect.andThen(cacheRoute(resource.cache, entry), resource.release),
        CacheRoute: ({ cache, entry }) => cacheRoute(cache, entry),
        DiscardRoute: ({ rendererNavigation, resource }) =>
          discardRoute(rendererNavigation, resource),
        PublishRoute: () =>
          Effect.die(
            navigationInvariant("Cannot execute the PublishRoute lifecycle command here."),
          ),
        ReleaseRoute: ({ resource }) => resource.release,
        SupersedeCandidate: ({ candidate }) => supersede(candidate),
      });
