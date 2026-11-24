import { Context, Effect, Exit, FiberHandle, Layer, Option, Predicate, Ref, Scope } from "effect";

import { BrowserRenderer } from "./browser-renderer.ts";
import { NavigationApi } from "./navigation-api.ts";
import { isRoutedNavigation, preserveRequestedHash } from "./navigation-routing.ts";
import { RouteLoader } from "./route-loader.ts";
import type { RouteLoad } from "./route-loader.ts";
import { publishRefresh } from "./route-render.ts";
import type { PublishedRefresh, RouteRefreshTransitionType } from "./route-render.ts";

export type { RouteRefreshTransitionType } from "./route-render.ts";

type Completed = Effect.Success<typeof Effect.void>;

type RouteRefreshImplementation = Readonly<{
  interruptCurrentRouteRefresh: Effect.Effect<void>;
  refreshCurrentRoute: (transitionType: RouteRefreshTransitionType) => Effect.Effect<void>;
}>;

const makeRouteRefresher = Effect.gen(function* () {
  const navigation = yield* NavigationApi;
  const implementation = yield* Ref.make<RouteRefreshImplementation>({
    interruptCurrentRouteRefresh: Effect.void,
    refreshCurrentRoute: () => Effect.sync(navigation.reloadDocument),
  });
  const interruptCurrentRouteRefresh = Ref.get(implementation).pipe(
    Effect.flatMap((current) => current.interruptCurrentRouteRefresh),
  );
  const refreshCurrentRoute = (transitionType: RouteRefreshTransitionType): Effect.Effect<void> =>
    Ref.get(implementation).pipe(
      Effect.flatMap((current) => current.refreshCurrentRoute(transitionType)),
    );
  return {
    interruptCurrentRouteRefresh,
    refreshCurrentRoute,
    replace: (replacement: RouteRefreshImplementation) => Ref.set(implementation, replacement),
  };
});

export class RouteRefresher extends Context.Service<RouteRefresher>()(
  "effront/client/RouteRefresher",
  { make: makeRouteRefresher },
) {
  // oxlint-disable-next-line rules/no-readonly -- Preserve the fixed reference to the runtime service layer.
  public static readonly layer = Layer.effect(this, this.make);

  // oxlint-disable-next-line rules/no-readonly -- Preserve the fixed reference used by test layers.
  public static readonly layerTest = Layer.mock(this);
}

const waitForNavigationIdle = (navigation: NavigationApi["Service"]): Effect.Effect<void> =>
  Effect.suspend(() => {
    const transition = navigation.getTransition();
    if (Predicate.isNullish(transition)) {
      return Effect.succeed("Idle" as const);
    }
    return Effect.promise(async () => {
      try {
        await transition.finished;
      } catch {
        // A rejected transition also settled. Check whether a newer one has started.
      }
      return "Settled" as const;
    });
  }).pipe(Effect.repeat({ while: (state) => state === "Settled" }), Effect.asVoid);

const waitForRoutedNavigation = (navigation: NavigationApi["Service"]): Effect.Effect<void> =>
  Effect.callback<Completed>((resume) => {
    const onNavigate = (event: NavigateEvent): void => {
      if (isRoutedNavigation(event)) {
        resume(Effect.void);
      }
    };
    const unsubscribe = navigation.subscribe(onNavigate);
    return Effect.sync(unsubscribe);
  });

type RouteResource = Extract<RouteLoad, Readonly<{ routeTree: unknown }>>;

const isRouteResource = Predicate.isTagged("Route");

type LoadRelease = Readonly<{
  destination: URL;
  release: Effect.Effect<void>;
  resource: RouteLoad;
}>;

const resolveRefresh = Effect.fnUntraced(function* (
  navigation: NavigationApi["Service"],
  { destination, release, resource }: LoadRelease,
) {
  if (!isRouteResource(resource)) {
    yield* release;
    yield* Effect.sync(navigation.reloadDocument);
    return Option.none();
  }
  const resolvedDestination = preserveRequestedHash(destination, resource.resolvedUrl);
  if (resolvedDestination.href !== destination.href) {
    yield* release;
    yield* Effect.sync(() => {
      navigation.replaceDocument(resolvedDestination.href);
    });
    return Option.none();
  }
  return Option.some(resource);
});

type RouteRefreshServices = Readonly<{
  browserScope: Scope.Scope;
  navigation: NavigationApi["Service"];
  renderer: BrowserRenderer["Service"];
  routeLoader: RouteLoader["Service"];
}>;

type ActiveRefresh = Readonly<{
  release: Effect.Effect<void>;
  route: RouteResource;
  transitionType: RouteRefreshTransitionType;
}>;

const trackPublishedRefresh = Effect.fnUntraced(function* (
  services: RouteRefreshServices,
  { release, route, transitionType }: ActiveRefresh,
) {
  const commitRefresh = services.routeLoader.prepareRefresh(route.routeTree);
  const published = yield* publishRefresh(services.renderer, route.routeTree, transitionType);
  const completed = Effect.all([Effect.promise(async () => published.committed), route.completed], {
    concurrency: "unbounded",
    discard: true,
  });
  const commit = completed.pipe(Effect.andThen(Effect.sync(commitRefresh)));
  yield* Effect.raceFirst(
    commit,
    Effect.promise(async () => published.retired),
  ).pipe(
    Effect.ensuring(release),
    Effect.catch((error) => Effect.logError("Failed to stream the refreshed route.", error)),
    Effect.forkIn(services.browserScope, { startImmediately: true }),
  );

  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      // The stream fiber awaits retirement; this finalizer must let a replacement render commit.
      // oxlint-disable-next-line typescript/no-floating-promises -- Discard schedules retirement while the stream still owns release.
      published.discard();
    }),
  );
  return published;
});

const refreshRoute = Effect.fnUntraced(function* (
  services: RouteRefreshServices,
  transitionType: RouteRefreshTransitionType,
) {
  const responseScope = yield* Scope.make();
  const published = yield* Effect.uninterruptibleMask((restore) =>
    Effect.gen(function* () {
      const current = services.navigation.getCurrentEntry();
      const destination = new URL(current?.url ?? services.navigation.getCurrentUrl());
      const load = services.routeLoader.load({
        destination: { id: current?.id ?? "", url: destination.href },
        navigationType: "replace",
      });
      const resource = yield* restore(load.pipe(Scope.provide(responseScope)));
      const release = resource.release.pipe(Scope.use(responseScope));
      const route = yield* resolveRefresh(services.navigation, { destination, release, resource });
      if (Option.isNone(route)) {
        return Option.none<PublishedRefresh>();
      }
      // The browser owns the published stream before cancellation can retire the render.
      const render = yield* trackPublishedRefresh(services, {
        release,
        route: route.value,
        transitionType,
      });
      return Option.some(render);
    }).pipe(Effect.onError((cause) => Scope.close(responseScope, Exit.failCause(cause)))),
  );
  if (Option.isSome(published)) {
    yield* Effect.promise(async () => published.value.committed);
  }
});

const makeRefreshOperation = ({
  navigation,
  routeLoader,
  ...rest
}: RouteRefreshServices): ((transitionType: RouteRefreshTransitionType) => Effect.Effect<void>) => {
  const services = { ...rest, navigation, routeLoader };
  const idle = waitForNavigationIdle(navigation);
  const routed = waitForRoutedNavigation(navigation);
  return Effect.fnUntraced(
    function* (transitionType: RouteRefreshTransitionType) {
      routeLoader.invalidate();
      yield* idle;
      // Only publication belongs to the React Transition.
      yield* Effect.raceFirst(refreshRoute(services, transitionType), routed);
    },
    Effect.scoped,
    Effect.matchEffect({
      onFailure: (error) => Effect.logError("Failed to refresh the current route.", error),
      onSuccess: () => Effect.void,
    }),
  );
};

export const installRouteRefresh = Effect.gen(function* () {
  const renderer = yield* BrowserRenderer;
  const navigation = yield* NavigationApi;
  const routeLoader = yield* RouteLoader;
  const routeRefresher = yield* RouteRefresher;
  const refreshes = yield* FiberHandle.make<Completed>();
  const browserScope = yield* Effect.scope;
  const refresh = makeRefreshOperation({ browserScope, navigation, renderer, routeLoader });
  yield* routeRefresher.replace({
    interruptCurrentRouteRefresh: FiberHandle.clear(refreshes),
    refreshCurrentRoute: (transitionType) =>
      FiberHandle.run(refreshes, refresh(transitionType)).pipe(Effect.asVoid),
  });
});
