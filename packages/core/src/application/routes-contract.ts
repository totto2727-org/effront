import type { Types } from "effect";

import type { EFFRONTStatefulMember } from "./effront-identity.ts";
import type { LayoutComponent } from "./layout.ts";
import type { LoadingComponent } from "./loading.ts";
import type { AnyMiddleware } from "./middleware.ts";
import type { AnyPageDefinition, PageConcern } from "./page.ts";
import type {
  AbsolutePath,
  JoinPath,
  RouteParamNames,
  RouteShape,
  ValidRoutePath,
} from "./route-path.ts";

export declare const RoutesContractTypeId: unique symbol;

export type RoutesState<
  HasLayout extends boolean,
  Paths extends AbsolutePath,
  Shapes extends AbsolutePath,
> = Readonly<{
  hasLayout: Types.Covariant<HasLayout>;
  paths: Types.Covariant<Paths>;
  shapes: Types.Covariant<Shapes>;
}>;

export type MountedPaths<Prefix extends AbsolutePath, Child> =
  RoutesPaths<Child> extends infer Path extends AbsolutePath ? JoinPath<Prefix, Path> : never;

export type NoPathCollision<CurrentShapes extends AbsolutePath, Added extends AbsolutePath> = [
  Extract<RouteShape<Added>, CurrentShapes>,
] extends [never]
  ? unknown
  : never;

type PageParamNames<Page> =
  Page extends PageConcern<infer ParamNames, infer _Mode> ? ParamNames : never;

type PageMode<Page> = Page extends PageConcern<infer _ParamNames, infer Mode> ? Mode : never;

type ExactPageParamNames<Path extends AbsolutePath, Page> = [RouteParamNames<Path>] extends [
  PageParamNames<Page>,
]
  ? [PageParamNames<Page>] extends [RouteParamNames<Path>]
    ? unknown
    : never
  : never;

export type MatchingPageParams<Path extends AbsolutePath, Page> =
  PageMode<Page> extends "Static"
    ? [RouteParamNames<Path>] extends [never]
      ? unknown
      : never
    : PageMode<Page> extends "Parameterized"
      ? [RouteParamNames<Path>] extends [never]
        ? never
        : ExactPageParamNames<Path, Page>
      : never;

export type StaticMountPath<Path extends AbsolutePath> = [RouteParamNames<Path>] extends [never]
  ? unknown
  : never;

export type KnownNonEmptyRoutes<Definition> =
  AbsolutePath extends RoutesPaths<Definition>
    ? never
    : [RoutesPaths<Definition>] extends [never]
      ? never
      : unknown;

export interface RoutesDefinition<
  Services,
  out HasLayout extends boolean,
  out Paths extends AbsolutePath,
  // Retain each matcher shape so additions do not recompute every earlier path's shape.
  out Shapes extends AbsolutePath = RouteShape<Paths>,
>
  extends
    EFFRONTStatefulMember<Services, "Routes", RoutesImplementationState<Services>>,
    Readonly<{ [RoutesContractTypeId]: RoutesState<HasLayout, Paths, Shapes> }> {
  /**
   * Register a literal, `:parameter`, or terminal `*parameter` route.
   * A catch-all captures the remaining decoded path, including an empty string at its prefix.
   * Its prefix is reserved too, so `/manual` cannot coexist with `/manual/*path`.
   */
  // oxlint-disable-next-line typescript/method-signature-style -- Method compatibility preserves the persistent generic route builder contract.
  page<const Path extends AbsolutePath, const Page extends AnyPageDefinition<Services>>(
    path: Path & ValidRoutePath<Path> & NoPathCollision<Shapes, Path>,
    page: Page & MatchingPageParams<Path, Page>,
  ): RoutesDefinition<Services, HasLayout, Paths | Path, Shapes | RouteShape<Path>>;

  // oxlint-disable-next-line typescript/method-signature-style -- Method compatibility preserves generic child and mount route inference.
  mount<const Prefix extends AbsolutePath, const Child extends AnyRoutes<Services>>(
    path: Prefix & ValidRoutePath<Prefix> & StaticMountPath<Prefix>,
    routes: Child &
      KnownNonEmptyRoutes<Child> &
      NoPathCollision<Shapes, MountedPaths<Prefix, Child>>,
  ): RoutesDefinition<
    Services,
    HasLayout,
    Paths | MountedPaths<Prefix, Child>,
    Shapes | RouteShape<MountedPaths<Prefix, Child>>
  >;
}

export type AnyRoutes<Services> = RoutesDefinition<Services, boolean, AbsolutePath>;

export type RoutesHasLayout<Definition> =
  Definition extends RoutesDefinition<infer _Services, infer HasLayout, infer _Paths, infer _Shapes>
    ? HasLayout
    : never;

export type RoutesPaths<Definition> =
  Definition extends RoutesDefinition<infer _Services, infer _HasLayout, infer Paths, infer _Shapes>
    ? Paths
    : never;

type RoutesPage<Services> = Readonly<{
  page: AnyPageDefinition<Services>;
  path: AbsolutePath;
}>;

type RoutesMount<Services> = Readonly<{
  path: AbsolutePath;
  routes: AnyRoutes<Services>;
}>;

export type RoutesImplementationState<Services> = Readonly<{
  layout: LayoutComponent<Services> | null;
  loading: LoadingComponent<Services> | null;
  middleware: Readonly<AnyMiddleware<Services>[]>;
  mounts: Readonly<RoutesMount<Services>[]>;
  pages: Readonly<RoutesPage<Services>[]>;
  paths: Readonly<AbsolutePath[]>;
  scopeId: number;
}>;

export type RoutesOptions<Services> = Readonly<{
  layout?: LayoutComponent<Services>;
  loading?: LoadingComponent<Services>;
}>;

export type HasLayoutFromOptions<Options> =
  Options extends Readonly<{ layout: unknown }> ? true : false;

export type RoutesFactory<Services> = Readonly<{
  make: {
    (): RoutesDefinition<Services, false, never>;
    <Options extends RoutesOptions<Services>>(
      options: Options,
    ): RoutesDefinition<Services, HasLayoutFromOptions<Options>, never>;
  };
}>;
