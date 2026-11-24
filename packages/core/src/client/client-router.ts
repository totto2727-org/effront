import { Predicate, Effect, Exit, MutableRef } from "effect";
import { addTransitionType, startTransition } from "react";

import { BrowserEffectRunner } from "./browser-effect-runner.ts";
import { BrowserRenderer } from "./browser-renderer.ts";
import type { BrowserRendererNavigation } from "./browser-renderer.ts";
import { NavigationApi } from "./navigation-api.ts";
import { initialRouterState, routerEvents } from "./navigation-router-model.ts";
import type { RouterCommand, RouterEvent, RouterState } from "./navigation-router-model.ts";
import { reduceRouterState } from "./navigation-router-reducer.ts";
import {
  isRoutedNavigation,
  NativeDocumentNavigationInfo,
  preserveRequestedHash,
} from "./navigation-routing.ts";
import {
  getLinkTransitionTypes,
  getNavigationTransitionTypes,
} from "./navigation-transition-types.ts";
import { RouteLoader } from "./route-loader.ts";
import type { RouteResource } from "./route-loader.ts";

type NavigationGeneration = symbol;

type NavigationPreparation =
  | Readonly<{ _tag: "Handled" }>
  | Readonly<{
      _tag: "Rendered";
      rendererNavigation: BrowserRendererNavigation;
      resolvedDestination: URL;
      resource: RouteResource;
    }>;

export const installClientRouter = Effect.gen(function* () {
  const browserRenderer = yield* BrowserRenderer;
  const navigationApi = yield* NavigationApi;
  const routeLoader = yield* RouteLoader;
  const run = yield* BrowserEffectRunner;
  const routerState = MutableRef.make<RouterState>(initialRouterState());

  const dispatch = (event: RouterEvent) => {
    const transition = reduceRouterState(MutableRef.get(routerState), event);
    MutableRef.set(routerState, transition.state);
    return transition;
  };

  const executeRouterCommand = Effect.fnUntraced(function* (command: RouterCommand | undefined) {
    if (Predicate.isNullish(command)) {
      return;
    }
    switch (command._tag) {
      case "SupersedeCandidate": {
        const { candidate } = command;
        yield* Effect.sync(() => {
          candidate.lifetime.abort();
        });
        if (candidate._tag === "Loading") {
          break;
        }
        if (candidate._tag === "Publishing") {
          yield* candidate.resource.release;
          break;
        }
        yield* Effect.promise(() => candidate.rendererNavigation.discard()).pipe(
          Effect.ensuring(candidate.resource.release),
        );
        break;
      }
      case "ReleaseRoute": {
        yield* command.resource.release;
        break;
      }
      case "CacheRoute": {
        yield* Effect.sync(() => {
          command.cache(command.entry);
        });
        break;
      }
      case "CacheAndReleaseRoute": {
        yield* Effect.sync(() => {
          command.resource.cache(command.entry);
        });
        yield* command.resource.release;
        break;
      }
      case "DiscardRoute": {
        yield* Effect.promise(() => command.rendererNavigation.discard()).pipe(
          Effect.ensuring(command.resource.release),
        );
        break;
      }
      default: {
        throw new TypeError(`Cannot execute the ${command._tag} lifecycle command here.`);
      }
    }
  });

  const openDocument = (event: NavigateEvent, destination: URL): void => {
    if (event.navigationType === "traverse") {
      navigationApi.replaceDocument(destination.href);
      return;
    }
    navigationApi.navigate(destination.href, {
      history: event.navigationType === "replace" ? "replace" : "push",
      info: NativeDocumentNavigationInfo,
    });
  };

  const onNavigate = (event: NavigateEvent): void => {
    if (!isRoutedNavigation(event)) {
      return;
    }

    const destination = new URL(event.destination.url);
    const linkTransitionTypes = getLinkTransitionTypes(event);
    const generation: NavigationGeneration = Symbol("NavigationGeneration");
    const lifetime = new AbortController();
    const navigationSignal = AbortSignal.any([event.signal, lifetime.signal]);
    const begin = dispatch(routerEvents.BeginNavigation({ generation, lifetime }));
    void run(executeRouterCommand(begin.command)).catch(() => undefined);
    // Navigation handlers are native Promise boundaries.
    const handler = async (precommitController?: NavigationPrecommitController): Promise<void> => {
      const preparation = Promise.withResolvers<NavigationPreparation>();

      const navigationAction = Effect.gen(function* () {
        const resource = yield* routeLoader
          .load({
            destination: event.destination,
            navigationType: event.navigationType,
          })
          .pipe(
            Effect.onError(() =>
              Effect.sync(() => {
                dispatch(routerEvents.FlightFailed({ generation }));
              }),
            ),
          );

        if (resource._tag === "Document") {
          dispatch(routerEvents.DocumentLoaded({ generation }));
          yield* resource.release;
          openDocument(event, destination);
          return { _tag: "Handled" } as const;
        }

        const resolvedDestination = preserveRequestedHash(destination, resource.resolvedUrl);
        if (resolvedDestination.origin !== destination.origin) {
          dispatch(routerEvents.DocumentLoaded({ generation }));
          yield* resource.release;
          openDocument(event, resolvedDestination);
          return { _tag: "Handled" } as const;
        }

        if (
          destination.href !== resolvedDestination.href &&
          (Predicate.isNullish(precommitController) || event.navigationType === "traverse")
        ) {
          dispatch(routerEvents.DocumentLoaded({ generation }));
          yield* resource.release;
          navigationApi.replaceDocument(resolvedDestination.href);
          return { _tag: "Handled" } as const;
        }

        const transition = dispatch(routerEvents.RouteLoaded({ generation, resource }));
        const { command } = transition;
        if (command?._tag === "ReleaseRoute") {
          yield* command.resource.release;
          return { _tag: "Handled" } as const;
        }
        if (command?._tag === "PublishRoute") {
          const rendererNavigation = yield* Effect.sync(() => {
            let navigation!: BrowserRendererNavigation;
            startTransition(() => {
              const fromIndex =
                navigationApi.getTransition()?.from.index ??
                navigationApi.getCurrentEntry()?.index ??
                null;
              for (const type of getNavigationTransitionTypes(event, fromIndex)) {
                addTransitionType(type);
              }
              for (const type of linkTransitionTypes) {
                addTransitionType(type);
              }
              navigation = browserRenderer.navigate(command.resource.routeTree);
            });
            return navigation;
          });
          const scheduled = dispatch(
            routerEvents.RenderScheduled({
              generation: command.generation,
              rendererNavigation,
              resource: command.resource,
            }),
          );
          if (Predicate.isNotNullish(scheduled.command)) {
            yield* executeRouterCommand(scheduled.command);
            return { _tag: "Handled" } as const;
          }
          return {
            _tag: "Rendered",
            rendererNavigation,
            resolvedDestination,
            resource: command.resource,
          } as const;
        }

        throw new TypeError("A loaded route must be published or released.");
      });

      // React Transition Actions are a native Promise boundary.
      startTransition(async () => {
        await run(navigationAction, { signal: navigationSignal })
          .then(preparation.resolve)
          .catch(preparation.reject);
      });

      const abortNavigation = Effect.suspend(() => {
        const transition = dispatch(routerEvents.NavigationAborted({ generation }));
        return executeRouterCommand(transition.command);
      });
      const outcome = await preparation.promise.catch((error) => {
        if (navigationSignal.aborted) {
          return run(abortNavigation.pipe(Effect.as({ _tag: "Handled" } as NavigationPreparation)));
        }
        if (!event.cancelable && event.navigationType === "traverse") {
          navigationApi.reloadDocument();
          return { _tag: "Handled" } as NavigationPreparation;
        }
        throw error;
      });
      if (outcome._tag === "Handled") {
        return;
      }

      const { rendererNavigation, resolvedDestination, resource } = outcome;
      const waitForNavigationCommit = Effect.uninterruptibleMask((restore) =>
        restore(Effect.promise(() => rendererNavigation.committed)).pipe(
          Effect.tap(
            Effect.suspend(() => {
              const transition = dispatch(routerEvents.RenderCommitted({ generation }));
              return executeRouterCommand(transition.command);
            }),
          ),
          Effect.onExit((exit) => (Exit.isFailure(exit) ? abortNavigation : Effect.void)),
        ),
      );
      try {
        await run(waitForNavigationCommit, { signal: navigationSignal });
      } catch (error) {
        if (navigationSignal.aborted) {
          return;
        }
        throw error;
      }

      const waitForRenderRetirement = Effect.gen(function* () {
        yield* Effect.promise(() => rendererNavigation.retired);
        dispatch(routerEvents.RenderRetired({ generation }));
      }).pipe(
        // A newer generation may already be current when this render retires.
        Effect.ensuring(resource.release),
        Effect.ignore,
      );
      void run(waitForRenderRetirement).catch(() => undefined);

      const waitForFlightCompletion = Effect.gen(function* () {
        const flightExit = yield* Effect.exit(resource.completed);
        const transition = dispatch(
          Exit.isSuccess(flightExit)
            ? routerEvents.FlightCompleted({ generation })
            : routerEvents.FlightFailed({ generation }),
        );
        yield* executeRouterCommand(transition.command);
      });
      void run(waitForFlightCompletion).catch(() => undefined);

      if (
        destination.href !== resolvedDestination.href &&
        Predicate.isNotNullish(precommitController)
      ) {
        precommitController.redirect(resolvedDestination.href, { history: "auto" });
      }
      const commitHistory = Effect.suspend(() => {
        const transition = dispatch(
          routerEvents.HistoryCommitted({
            entry: navigationApi.getCurrentEntry(),
            generation,
          }),
        );
        return executeRouterCommand(transition.command);
      });
      if (Predicate.isNullish(precommitController)) {
        await run(commitHistory);
      } else {
        precommitController.addHandler(() => run(commitHistory));
      }
    };

    event.intercept(
      event.cancelable
        ? { precommitHandler: handler }
        : {
            // Browsers make some traversals non-cancelable so an application cannot trap users.
            handler,
          },
    );
  };

  yield* Effect.acquireRelease(
    Effect.sync(() => navigationApi.subscribe(onNavigate)),
    (unsubscribe) => Effect.sync(unsubscribe),
  );
});
