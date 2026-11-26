import { Effect, Match, Predicate } from "effect";

import type { NavigationContext, NavigationRequest } from "./navigation-request.ts";
import { preparations } from "./navigation-request.ts";
import { publishNavigation } from "./navigation-publication.ts";
import { executeRouterCommand } from "./navigation-router-command.ts";
import type { routerCommands } from "./navigation-router-model.ts";
import { navigationInvariant, routerEvents } from "./navigation-router-model.ts";
import { NativeDocumentNavigationInfo, preserveRequestedHash } from "./navigation-routing.ts";
import { isDocumentLoad } from "./route-loader.ts";
import type { RouteResource } from "./route-loader.ts";

type LoadedNavigation = Readonly<{ resource: RouteResource; resolvedDestination: URL }>;
type PublishCommand = ReturnType<typeof routerCommands.PublishRoute>;

const schedulePublication = Effect.fnUntraced(function* (
  context: NavigationContext,
  request: NavigationRequest,
  { command, resolvedDestination }: Readonly<{ command: PublishCommand; resolvedDestination: URL }>,
) {
  const { generation, resource } = command;
  const rendererNavigation = yield* publishNavigation(context, request, resource);
  const scheduled = context.dispatch(
    routerEvents.RenderScheduled({ generation, rendererNavigation, resource }),
  );
  if (Predicate.isNotNullish(scheduled.command)) {
    yield* executeRouterCommand(scheduled.command);
    return preparations.Handled();
  }
  return preparations.Rendered({ rendererNavigation, resolvedDestination, resource });
});

const publishLoadedRoute = Effect.fnUntraced(function* (
  context: NavigationContext,
  request: NavigationRequest,
  { resource, resolvedDestination }: LoadedNavigation,
) {
  const effect = Match.value(
    context.dispatch(routerEvents.RouteLoaded({ generation: request.generation, resource }))
      .command,
  ).pipe(
    Match.tag("ReleaseRoute", (command) =>
      Effect.as(command.resource.release, preparations.Handled()),
    ),
    Match.tag("PublishRoute", (command) =>
      schedulePublication(context, request, { command, resolvedDestination }),
    ),
    Match.orElse(() =>
      Effect.die(navigationInvariant("A loaded route must be published or released.")),
    ),
  );
  return yield* effect;
});

type FallbackResource = Pick<RouteResource, "release">;
type DocumentFallback = Readonly<{
  destination: URL;
  release: FallbackResource["release"];
  replace: boolean;
}>;

const openDocument = (
  navigation: NavigationContext["navigation"],
  event: NavigateEvent,
  { destination, replace }: DocumentFallback,
): void => {
  if (replace || event.navigationType === "traverse") {
    navigation.replaceDocument(destination.href);
    return;
  }
  navigation.navigate(destination.href, {
    history: event.navigationType === "replace" ? "replace" : "push",
    info: NativeDocumentNavigationInfo,
  });
};

const fallBackToDocument = Effect.fnUntraced(function* (
  { dispatch, navigation }: NavigationContext,
  { event, generation }: NavigationRequest,
  fallback: DocumentFallback,
) {
  dispatch(routerEvents.DocumentLoaded({ generation }));
  yield* fallback.release;
  openDocument(navigation, event, fallback);
  return preparations.Handled();
});

const prepareResolvedRoute = Effect.fnUntraced(function* (
  context: NavigationContext,
  request: NavigationRequest,
  {
    precommit,
    resource,
  }: Readonly<{ precommit: NavigationPrecommitController | undefined; resource: RouteResource }>,
) {
  const { destination, event } = request;
  const resolved = preserveRequestedHash(destination, resource.resolvedUrl);
  if (resolved.origin !== destination.origin) {
    return yield* fallBackToDocument(context, request, {
      destination: resolved,
      release: resource.release,
      replace: false,
    });
  }
  if (
    destination.href !== resolved.href &&
    (Predicate.isNullish(precommit) || event.navigationType === "traverse")
  ) {
    return yield* fallBackToDocument(context, request, {
      destination: resolved,
      release: resource.release,
      replace: true,
    });
  }
  return yield* publishLoadedRoute(context, request, { resolvedDestination: resolved, resource });
});

export const prepareNavigation = Effect.fnUntraced(function* (
  context: NavigationContext,
  request: NavigationRequest,
  precommit: NavigationPrecommitController | undefined,
) {
  const { dispatch, routeLoader } = context;
  const { destination, event, generation } = request;
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

  if (isDocumentLoad(resource)) {
    return yield* fallBackToDocument(context, request, {
      destination,
      release: resource.release,
      replace: false,
    });
  }

  return yield* prepareResolvedRoute(context, request, { precommit, resource });
});
