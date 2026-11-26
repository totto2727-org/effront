import { Array, Predicate } from "effect";

import {
  EFFRONTIdentityTypeId,
  EFFRONTMemberKindTypeId,
  EFFRONTStateTypeId,
  getEFFRONTIdentity,
  isEFFRONTMember,
} from "./effront-identity.ts";
import type { EFFRONTIdentity } from "./effront-identity.ts";
import type { AnyMiddleware } from "./middleware.ts";
import { getPageState } from "./page.ts";
import type { AnyPageDefinition } from "./page.ts";
import { analyzeRoutePath, joinRoutePaths } from "./route-path.ts";
import type { AbsolutePath, RouteShape, ValidRoutePath } from "./route-path.ts";
import type {
  AnyRoutes,
  HasLayoutFromOptions,
  KnownNonEmptyRoutes,
  MatchingPageParams,
  MountedPaths,
  NoPathCollision,
  RoutesContractTypeId,
  RoutesDefinition,
  RoutesFactory,
  RoutesImplementationState,
  RoutesOptions,
  RoutesState,
  StaticMountPath,
} from "./routes-contract.ts";

export type {
  AnyRoutes,
  RoutesDefinition,
  RoutesFactory,
  RoutesHasLayout,
  RoutesImplementationState,
  RoutesPaths,
} from "./routes-contract.ts";

type RuntimeRoutesOptions<Services> = RoutesImplementationState<Services> &
  Readonly<{ routeShapes: ReadonlySet<string> }>;

const invalidRoutes = (message: string): TypeError =>
  // oxlint-disable-next-line rules/require-tagged-error -- Synchronous authoring errors keep the public TypeError contract.
  new TypeError(message);

export const getRoutesState = <Services>(
  routes: AnyRoutes<Services>,
): RoutesImplementationState<Services> => {
  if (!isEFFRONTMember(routes, "Routes")) {
    throw invalidRoutes("Routes must be created with EFFRONT.Routes.make.");
  }
  return routes[EFFRONTStateTypeId];
};

const checkPageConcern = <Services>(
  { page, path }: Readonly<{ page: AnyPageDefinition<Services>; path: AbsolutePath }>,
  route: ReturnType<typeof analyzeRoutePath>,
  identity: EFFRONTIdentity<Services>,
): void => {
  const pageState = getPageState(page);
  if (getEFFRONTIdentity(page) !== identity) {
    throw invalidRoutes(`Page for "${path}" was created by a different EFFRONT module.`);
  }
  const hasParameters = Predicate.hasProperty(route, "parameterNames");
  const hasDecoder = Predicate.isNotNullish(pageState.decodeParams);
  if (!hasParameters && hasDecoder) {
    throw invalidRoutes(`Parameterized Page for "${path}" requires route parameters.`);
  }
  if (hasParameters && !hasDecoder) {
    throw invalidRoutes(`Page for "${path}" must declare a parameter Schema.`);
  }
};

const mountedPaths = <Services>(
  path: AbsolutePath,
  routes: AnyRoutes<Services>,
  identity: EFFRONTIdentity<Services>,
): AbsolutePath[] => {
  if (Predicate.hasProperty(analyzeRoutePath(path), "parameterNames")) {
    throw invalidRoutes(`Routes cannot be mounted beneath parameterized path "${path}".`);
  }
  const state = getRoutesState(routes);
  if (Array.isReadonlyArrayEmpty(state.paths)) {
    throw invalidRoutes(`Cannot mount empty Routes at "${path}".`);
  }
  if (getEFFRONTIdentity(routes) !== identity) {
    throw invalidRoutes(`Routes mounted at "${path}" were created by a different EFFRONT module.`);
  }
  return state.paths.map((child) => joinRoutePaths(path, child));
};

const checkNewShapes = (
  path: AbsolutePath,
  additions: Readonly<string[]>,
  shapes: Set<string>,
): void => {
  Array.forEach(additions, (shape) => {
    if (shapes.has(shape)) {
      throw invalidRoutes(`Route "${path}" conflicts with an existing route pattern.`);
    }
    shapes.add(shape);
  });
};

class RoutesDefinitionImpl<
  Services,
  HasLayout extends boolean,
  Paths extends AbsolutePath,
  Shapes extends AbsolutePath = RouteShape<Paths>,
> implements RoutesDefinition<Services, HasLayout, Paths, Shapes> {
  declare public [RoutesContractTypeId]: RoutesState<HasLayout, Paths, Shapes>;
  public [EFFRONTIdentityTypeId]: EFFRONTIdentity<Services>;
  public [EFFRONTMemberKindTypeId] = "Routes" as const;
  public get [EFFRONTStateTypeId](): RoutesImplementationState<Services> {
    return this;
  }

  public layout: RoutesImplementationState<Services>["layout"];
  public loading: RoutesImplementationState<Services>["loading"];
  public middleware: RoutesImplementationState<Services>["middleware"];
  public mounts: RoutesImplementationState<Services>["mounts"];
  public pages: RoutesImplementationState<Services>["pages"];
  public paths: RoutesImplementationState<Services>["paths"];
  public scopeId: number;
  #routeShapes: ReadonlySet<string>;

  public constructor(
    identity: EFFRONTIdentity<Services>,
    {
      layout,
      loading,
      middleware,
      mounts,
      pages,
      paths,
      routeShapes,
      scopeId,
    }: RuntimeRoutesOptions<Services>,
  ) {
    this[EFFRONTIdentityTypeId] = identity;
    this.layout = layout;
    this.loading = loading;
    this.middleware = middleware;
    this.mounts = mounts;
    this.pages = pages;
    this.paths = paths;
    this.scopeId = scopeId;
    this.#routeShapes = routeShapes;
    Object.freeze(this);
  }

  public page<const Path extends AbsolutePath, const Page extends AnyPageDefinition<Services>>(
    path: Path & ValidRoutePath<Path> & NoPathCollision<Shapes, Path>,
    page: Page & MatchingPageParams<Path, Page>,
  ): RoutesDefinitionImpl<Services, HasLayout, Paths | Path, Shapes | RouteShape<Path>> {
    const route = analyzeRoutePath(path);
    const routeShapes = new Set(this.#routeShapes);
    checkNewShapes(path, route.shapes, routeShapes);
    const identity = this[EFFRONTIdentityTypeId];
    const entry = Object.freeze({ page, path });
    checkPageConcern(entry, route, identity);
    return new RoutesDefinitionImpl(identity, {
      layout: this.layout,
      loading: this.loading,
      middleware: this.middleware,
      mounts: this.mounts,
      pages: Object.freeze([...this.pages, entry]),
      paths: Object.freeze([...this.paths, path]),
      routeShapes,
      scopeId: this.scopeId,
    });
  }

  public mount<const Prefix extends AbsolutePath, const Child extends AnyRoutes<Services>>(
    path: Prefix & ValidRoutePath<Prefix> & StaticMountPath<Prefix>,
    routes: Child &
      KnownNonEmptyRoutes<Child> &
      NoPathCollision<Shapes, MountedPaths<Prefix, Child>>,
  ): RoutesDefinitionImpl<
    Services,
    HasLayout,
    Paths | MountedPaths<Prefix, Child>,
    Shapes | RouteShape<MountedPaths<Prefix, Child>>
  > {
    const identity = this[EFFRONTIdentityTypeId];
    const paths = mountedPaths(path, routes, identity);
    const routeShapes = new Set(this.#routeShapes);
    Array.forEach(paths, (mounted) => {
      checkNewShapes(mounted, analyzeRoutePath(mounted).shapes, routeShapes);
    });

    const entry = Object.freeze({ path, routes });
    return new RoutesDefinitionImpl(identity, {
      layout: this.layout,
      loading: this.loading,
      middleware: this.middleware,
      mounts: Object.freeze([...this.mounts, entry]),
      pages: this.pages,
      paths: Object.freeze([...this.paths, ...paths]),
      routeShapes,
      scopeId: this.scopeId,
    });
  }
}

// oxlint-disable-next-line unicorn/no-null -- Missing route layouts and loaders use the existing route compiler sentinel.
const missingRouteComponent = null;

const checkOptionalConcern = <Services>(
  concern: RoutesOptions<Services>["layout" | "loading"],
  kind: "Layout" | "Loading",
  identity: EFFRONTIdentity<Services>,
): void => {
  // oxlint-disable-next-line rules/prefer-is-nullish -- Omitted options are undefined; an explicit null is an invalid route concern.
  if (Predicate.isUndefined(concern)) {
    return;
  }
  if (!isEFFRONTMember(concern, kind)) {
    throw invalidRoutes(`${kind} must be created with EFFRONT.${kind}.make.`);
  }
  if (getEFFRONTIdentity(concern) !== identity) {
    throw invalidRoutes(`${kind} was created by a different EFFRONT module.`);
  }
};

export const makeRoutesFactory = <Services>(
  identity: EFFRONTIdentity<Services>,
  middleware: Readonly<AnyMiddleware<Services>[]>,
  allocateScopeId: () => number,
): RoutesFactory<Services> => {
  function make(): RoutesDefinition<Services, false, never>;
  function make<Options extends RoutesOptions<Services>>(
    options: Options,
  ): RoutesDefinition<Services, HasLayoutFromOptions<Options>, never>;
  function make(options: RoutesOptions<Services> = {}): AnyRoutes<Services> {
    checkOptionalConcern(options.layout, "Layout", identity);
    checkOptionalConcern(options.loading, "Loading", identity);
    const scopeId = allocateScopeId();
    return new RoutesDefinitionImpl(identity, {
      layout: options.layout ?? missingRouteComponent,
      loading: options.loading ?? missingRouteComponent,
      middleware,
      mounts: Object.freeze([]),
      pages: Object.freeze([]),
      paths: Object.freeze([]),
      routeShapes: new Set(),
      scopeId,
    });
  }

  return { make };
};
