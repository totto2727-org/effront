import { Layer, type Types } from "effect";
import type { HttpRouter } from "effect/unstable/http";

import {
  type EFFRONTIdentity,
  EFFRONTIdentityTypeId,
  EFFRONTMemberKindTypeId,
  type EFFRONTStatefulMember,
  EFFRONTStateTypeId,
  getEFFRONTIdentity,
  isEFFRONTMember,
} from "./effront-identity";
import { type CompiledRouteGraph, compileRouteGraph } from "./route-graph";
import type { AbsolutePath, ReservedRoutePath } from "./route-path";
import { type AnyRoutes, type RoutesHasLayout, type RoutesPaths } from "./routes";

declare const ApplicationContractTypeId: unique symbol;

export interface ApplicationDefinition<
  Services,
  out ApplicationError = never,
  out Requirements = never,
> extends EFFRONTStatefulMember<
  Services,
  "Application",
  ApplicationImplementationState<Services, ApplicationError, Requirements>
> {
  readonly [ApplicationContractTypeId]: {
    readonly error: Types.Covariant<ApplicationError>;
    readonly requirements: Types.Covariant<Requirements>;
  };
}

export type ApplicationImplementationState<Services, ApplicationError, Requirements> = {
  readonly layer: Layer.Layer<Services, ApplicationError, HttpRouter.HttpRouter | Requirements>;
  readonly routes: CompiledRouteGraph<Services>;
};

class ApplicationDefinitionImpl<
  Services,
  ApplicationError,
  Requirements,
> implements ApplicationDefinition<Services, ApplicationError, Requirements> {
  declare readonly [ApplicationContractTypeId]: {
    readonly error: Types.Covariant<ApplicationError>;
    readonly requirements: Types.Covariant<Requirements>;
  };
  readonly [EFFRONTIdentityTypeId]: EFFRONTIdentity<Services>;
  readonly [EFFRONTMemberKindTypeId] = "Application" as const;
  get [EFFRONTStateTypeId](): ApplicationImplementationState<
    Services,
    ApplicationError,
    Requirements
  > {
    return this;
  }
  readonly layer: Layer.Layer<Services, ApplicationError, HttpRouter.HttpRouter | Requirements>;
  readonly routes: CompiledRouteGraph<Services>;

  constructor(
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
    throw new TypeError("Application must be created with EFFRONT.make.");
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
  ? {
      readonly layer?: Layer.Layer<
        Services,
        ApplicationError,
        HttpRouter.HttpRouter | Requirements
      >;
    }
  : {
      readonly layer: Layer.Layer<Services, ApplicationError, HttpRouter.HttpRouter | Requirements>;
    };

export type EFFRONTApplicationOptions<
  Services,
  Definition extends AnyRoutes<Services>,
  ApplicationError,
  Requirements,
> = {
  readonly routes: Definition & ValidRootRoutes<Services, Definition>;
} & ApplicationLayerOptions<Services, ApplicationError, Requirements>;

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
    throw new TypeError("Root Routes were created by a different EFFRONT module.");
  }

  return new ApplicationDefinitionImpl(
    identity,
    compileRouteGraph(routes),
    resolveApplicationLayer<Services, ApplicationError, Requirements>(layer),
  );
};
