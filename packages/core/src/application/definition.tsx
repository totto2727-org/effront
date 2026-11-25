import { Layer } from "effect";
import type { Types } from "effect";
import type { HttpRouter } from "effect/http";

import {
  authoringTypeError,
  EFFRONTIdentityTypeId,
  EFFRONTMemberKindTypeId,
  EFFRONTStateTypeId,
  getEFFRONTIdentity,
  isEFFRONTMember,
} from "./effront-identity.ts";
import type { EFFRONTIdentity, EFFRONTStatefulMember } from "./effront-identity.ts";
import { compileRouteGraph } from "./route-graph.ts";
import type { CompiledRouteGraph } from "./route-graph.ts";
import type { AbsolutePath, ReservedRoutePath } from "./route-path.ts";
import type { AnyRoutes, RoutesHasLayout, RoutesPaths } from "./routes.ts";

declare const ApplicationContractTypeId: unique symbol;

export interface ApplicationDefinition<
  Services,
  out ApplicationError = never,
  out Requirements = never,
>
  extends
    EFFRONTStatefulMember<
      Services,
      "Application",
      ApplicationImplementationState<Services, ApplicationError, Requirements>
    >,
    Readonly<{
      [ApplicationContractTypeId]: ApplicationContract<ApplicationError, Requirements>;
    }> {}

type ApplicationContract<ApplicationError, Requirements> = Readonly<{
  error: Types.Covariant<ApplicationError>;
  requirements: Types.Covariant<Requirements>;
}>;

export type ApplicationImplementationState<Services, ApplicationError, Requirements> = Readonly<{
  layer: Layer.Layer<Services, ApplicationError, HttpRouter.HttpRouter | Requirements>;
  routes: CompiledRouteGraph<Services>;
}>;

class ApplicationDefinitionImpl<
  Services,
  ApplicationError,
  Requirements,
> implements ApplicationDefinition<Services, ApplicationError, Requirements> {
  declare public [ApplicationContractTypeId]: ApplicationContract<ApplicationError, Requirements>;
  public [EFFRONTIdentityTypeId]: EFFRONTIdentity<Services>;
  public [EFFRONTMemberKindTypeId] = "Application" as const;
  public get [EFFRONTStateTypeId](): ApplicationImplementationState<
    Services,
    ApplicationError,
    Requirements
  > {
    return this;
  }
  public layer: Layer.Layer<Services, ApplicationError, HttpRouter.HttpRouter | Requirements>;
  public routes: CompiledRouteGraph<Services>;

  public constructor(
    identity: EFFRONTIdentity<Services>,
    routes: CompiledRouteGraph<Services>,
    layer: Layer.Layer<Services, ApplicationError, HttpRouter.HttpRouter | Requirements>,
  ) {
    this[EFFRONTIdentityTypeId] = identity;
    this.layer = layer;
    this.routes = routes;
    Object.defineProperties(this, {
      [EFFRONTIdentityTypeId]: { configurable: false, writable: false },
      layer: { configurable: false, writable: false },
      routes: { configurable: false, writable: false },
    });
  }
}

export const getApplicationState = <Services, ApplicationError, Requirements>(
  application: ApplicationDefinition<Services, ApplicationError, Requirements>,
): ApplicationImplementationState<Services, ApplicationError, Requirements> => {
  if (!isEFFRONTMember(application, "Application")) {
    throw authoringTypeError("Application must be created with EFFRONT.make.");
  }
  return application[EFFRONTStateTypeId];
};

export type ApplicationServices<Application> =
  Application extends ApplicationDefinition<
    infer Services,
    infer _ApplicationError,
    infer _Requirements
  >
    ? Services
    : never;

export type ApplicationRequirements<Application> =
  Application extends ApplicationDefinition<
    infer _Services,
    infer _ApplicationError,
    infer Requirements
  >
    ? Exclude<Requirements, HttpRouter.HttpRouter>
    : never;

type ValidRootRoutes<Services, Definition extends AnyRoutes<Services>> =
  RoutesHasLayout<Definition> extends true
    ? [RoutesPaths<Definition>] extends [never]
      ? never
      : [ReservedRoutes<RoutesPaths<Definition>>] extends [never]
        ? unknown
        : never
    : never;

type ReservedRoutes<Paths> = Paths extends AbsolutePath ? ReservedRoutePath<Paths> : never;

type ApplicationLayerOptions<Services, ApplicationError, Requirements> = [Services] extends [never]
  ? Readonly<{
      layer?: Layer.Layer<Services, ApplicationError, HttpRouter.HttpRouter | Requirements>;
    }>
  : Readonly<{
      layer: Layer.Layer<Services, ApplicationError, HttpRouter.HttpRouter | Requirements>;
    }>;

export type EFFRONTApplicationOptions<
  Services,
  Definition extends AnyRoutes<Services>,
  ApplicationError,
  Requirements,
> = Readonly<{
  routes: Definition & ValidRootRoutes<Services, Definition>;
}> &
  ApplicationLayerOptions<Services, ApplicationError, Requirements>;

export type EFFRONTMake<Services> = <
  Definition extends AnyRoutes<Services>,
  ApplicationError = never,
  Requirements = never,
>(
  options: EFFRONTApplicationOptions<Services, Definition, ApplicationError, Requirements>,
) => ApplicationDefinition<Services, ApplicationError, Requirements>;

function resolveApplicationLayer<Services, ApplicationError, Requirements>(
  layer: Layer.Layer<Services, ApplicationError, HttpRouter.HttpRouter | Requirements> | undefined,
): Layer.Layer<Services, ApplicationError, HttpRouter.HttpRouter | Requirements>;
function resolveApplicationLayer(layer: Layer.Any | undefined): Layer.Any {
  return layer ?? Layer.empty;
}

export const makeApplication = <
  Services,
  Definition extends AnyRoutes<Services>,
  ApplicationError = never,
  Requirements = never,
>(
  identity: EFFRONTIdentity<Services>,
  {
    layer,
    routes,
  }: EFFRONTApplicationOptions<Services, Definition, ApplicationError, Requirements>,
): ApplicationDefinition<Services, ApplicationError, Requirements> => {
  if (getEFFRONTIdentity(routes) !== identity) {
    throw authoringTypeError("Root Routes were created by a different EFFRONT module.");
  }

  return new ApplicationDefinitionImpl(
    identity,
    compileRouteGraph(routes),
    resolveApplicationLayer<Services, ApplicationError, Requirements>(layer),
  );
};
