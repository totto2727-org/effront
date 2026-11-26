import { Array, Predicate } from "effect";

import type { LayoutComponent } from "./layout.ts";
import type { LoadingComponent } from "./loading.ts";
import type { AnyMiddleware } from "./middleware.ts";
import { getPageState } from "./page.ts";
import type { PageImplementationState } from "./page.ts";
import { joinRoutePaths, validateUnreservedPath } from "./route-path.ts";
import type { AbsolutePath } from "./route-path.ts";
import { getRoutesState } from "./routes.ts";
import type { AnyRoutes, RoutesImplementationState } from "./routes.ts";

export type RouteScope<Services> = Readonly<{
  id: string;
  layout: LayoutComponent<Services> | null;
  loading: LoadingComponent<Services> | null;
}>;

export type CompiledDestination<Services> = Readonly<{
  middleware: Readonly<AnyMiddleware<Services>[]>;
  page: PageImplementationState<Services>;
  pattern: AbsolutePath;
  scopes: Readonly<RouteScope<Services>[]>;
}>;

export type CompiledRouteGraph<Services> = Readonly<
  [CompiledDestination<Services>, ...CompiledDestination<Services>[]]
>;

type RouteChain<Services> = Pick<CompiledDestination<Services>, "middleware" | "scopes">;
const noDivergence = -1;

const graphError = (message: string): TypeError =>
  // oxlint-disable-next-line rules/require-tagged-error -- Invalid route definitions retain the public synchronous TypeError contract.
  new TypeError(message);

const resolveRouteMiddleware = <Services>(
  inherited: Readonly<AnyMiddleware<Services>[]>,
  declared: Readonly<AnyMiddleware<Services>[]>,
): Readonly<AnyMiddleware<Services>[]> => {
  const sharedCount = inherited.findIndex((item, index) => item !== declared[index]);
  return sharedCount === noDivergence
    ? declared
    : Object.freeze([...inherited, ...declared.slice(sharedCount)]);
};

const resolveRouteScopes = <Services>(
  state: RoutesImplementationState<Services>,
  prefix: AbsolutePath,
  inherited: Readonly<RouteScope<Services>[]>,
): Readonly<RouteScope<Services>[]> => {
  const { layout, loading, scopeId } = state;
  if (Predicate.isNullish(layout) && Predicate.isNullish(loading)) {
    return inherited;
  }
  return Object.freeze([
    ...inherited,
    Object.freeze({ id: `${scopeId}:${prefix}`, layout, loading }),
  ]);
};

const resolveRouteChain = <Services>(
  state: RoutesImplementationState<Services>,
  prefix: AbsolutePath,
  inherited: RouteChain<Services>,
): RouteChain<Services> => {
  const middleware = resolveRouteMiddleware(inherited.middleware, state.middleware);
  if (new Set(middleware).size !== middleware.length) {
    throw graphError(
      `Middleware beneath route prefix "${prefix}" appears more than once in its resolved chain.`,
    );
  }
  return { middleware, scopes: resolveRouteScopes(state, prefix, inherited.scopes) };
};

export const compileRouteGraph = <Services>(
  routes: AnyRoutes<Services>,
): CompiledRouteGraph<Services> => {
  const rootState = getRoutesState(routes);
  if (Predicate.isNullish(rootState.layout)) {
    throw graphError("The root Routes passed to EFFRONT.make must define a Layout.");
  }

  const destinations: CompiledDestination<Services>[] = [];
  const visit = (
    current: AnyRoutes<Services>,
    prefix: AbsolutePath,
    inherited: RouteChain<Services>,
  ): void => {
    const state = getRoutesState(current);
    const { middleware, scopes } = resolveRouteChain(state, prefix, inherited);
    Array.forEach(state.pages, (route) => {
      const pattern = joinRoutePaths(prefix, route.path);
      validateUnreservedPath(pattern);
      const page = getPageState(route.page);
      destinations.push(Object.freeze({ middleware, page, pattern, scopes }));
    });
    Array.forEach(state.mounts, (mount) => {
      visit(mount.routes, joinRoutePaths(prefix, mount.path), { middleware, scopes });
    });
  };
  visit(routes, "/", { middleware: [], scopes: [] });
  if (!Array.isArrayNonEmpty(destinations)) {
    throw graphError("The root Routes passed to EFFRONT.make must contain a Page.");
  }
  return Object.freeze(destinations);
};
