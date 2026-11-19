import type { ApplicationDefinition, ApplicationServices } from "@effront/core";
import type { HttpApplicationEffect, toHttpEffect as CoreHttpEffect } from "@effront/core/http";
import {
  Request,
  Worker,
  WorkerEnvironment,
  WorkerExecutionContext,
} from "alchemy/Cloudflare/Workers";
import { CloudflareEnvironment } from "alchemy/Cloudflare";
import { RuntimeContext } from "alchemy/RuntimeContext";
import { Self } from "alchemy/Self";
import { Context, Effect, Layer, Scope } from "effect";
import { HttpRouter, HttpServerRequest } from "effect/http";

import type { loadConfiguredApplication } from "./application-loader";

type HostServices =
  | Request
  | Worker
  | WorkerEnvironment
  | WorkerExecutionContext
  | CloudflareEnvironment
  | Self
  | RuntimeContext
  | HttpRouter.Provided
  | HttpRouter.HttpRouter
  | Layer.CurrentMemoMap
  | Scope.Scope;

const omitHostServices = Context.omit(
  RuntimeContext,
  Worker.Self,
  CloudflareEnvironment,
  Self,
  Layer.CurrentMemoMap,
  Request,
  WorkerEnvironment,
  WorkerExecutionContext,
  Scope.Scope,
  HttpServerRequest.HttpServerRequest,
  HttpServerRequest.ParsedSearchParams,
  HttpRouter.RouteContext,
  HttpRouter.HttpRouter,
);

// Ambient Context keys may exceed its type. Only already-excluded host keys are removed.
function captureApplicationContext<R>(
  context: Context.Context<Exclude<R, HostServices>>,
): Context.Context<Exclude<R, HostServices>>;
function captureApplicationContext(context: Context.Context<never>): Context.Context<never> {
  return omitHostServices(context);
}

/** Resolves an application within the current Worker request Effect. */
export type ApplicationLoader<
  Services,
  ApplicationError,
  Requirements,
  SourceError = never,
  SourceRequirements = never,
> = Effect.Effect<
  ApplicationDefinition<Services, ApplicationError, Requirements>,
  SourceError,
  SourceRequirements
>;

type ApplicationHttpEffect<
  ApplicationError,
  Requirements,
  SourceError = never,
  SourceRequirements = never,
> = Effect.Effect<
  Effect.Success<HttpApplicationEffect<ApplicationError, Requirements>>,
  Effect.Error<HttpApplicationEffect<ApplicationError, Requirements>> | SourceError,
  Effect.Services<HttpApplicationEffect<ApplicationError, Requirements>> | SourceRequirements
>;

type ApplicationCapabilities<Requirements, SourceRequirements = never> = Exclude<
  Effect.Services<HttpApplicationEffect<never, Requirements>> | SourceRequirements,
  HostServices
>;

type ApplicationConstruction<
  ApplicationError,
  Requirements,
  SourceError = never,
  SourceRequirements = never,
> = Effect.Effect<
  Effect.Effect<
    Effect.Success<HttpApplicationEffect<ApplicationError, Requirements>>,
    Effect.Error<HttpApplicationEffect<ApplicationError, Requirements>> | SourceError,
    Exclude<
      Effect.Services<HttpApplicationEffect<ApplicationError, Requirements>> | SourceRequirements,
      ApplicationCapabilities<Requirements, SourceRequirements>
    >
  >,
  never,
  ApplicationCapabilities<Requirements, SourceRequirements>
>;

/** Keeps declaration emission on named contracts and canonical public provider imports. */
export interface ApplicationAdapter {
  readonly applicationHttpEffect: <
    Services = never,
    ApplicationError = never,
    Requirements = never,
    SourceError = never,
    SourceRequirements = never,
  >(
    source: ApplicationLoader<
      Services,
      ApplicationError,
      Requirements,
      SourceError,
      SourceRequirements
    >,
  ) => ApplicationHttpEffect<ApplicationError, Requirements, SourceError, SourceRequirements>;
  readonly makeApplicationHttpEffect: <
    Services = never,
    ApplicationError = never,
    Requirements = never,
    SourceError = never,
    SourceRequirements = never,
  >(
    source: ApplicationLoader<
      Services,
      ApplicationError,
      Requirements,
      SourceError,
      SourceRequirements
    >,
  ) => ApplicationConstruction<ApplicationError, Requirements, SourceError, SourceRequirements>;
}

export interface ConfiguredApplicationHttpEffect {
  <
    Definition extends ApplicationDefinition<ApplicationServices<Definition>, unknown, unknown>,
  >(): Definition extends ApplicationDefinition<
    infer _Services,
    infer ApplicationError,
    infer Requirements
  >
    ? ApplicationConstruction<ApplicationError, Requirements>
    : never;
}

export const makeApplicationAdapter = (toHttpEffect: typeof CoreHttpEffect): ApplicationAdapter => {
  const applicationHttpEffect: ApplicationAdapter["applicationHttpEffect"] = (source) =>
    Effect.flatMap(source, toHttpEffect);

  /**
   * Captures non-host service references without executing the application source.
   *
   * Source and application Effects run in the live request scope. Its services take
   * precedence over captured references. Capturing references does not extend their
   * lifetimes: their owner must retain them through response consumption.
   */
  function makeApplicationHttpEffect<
    Services = never,
    ApplicationError = never,
    Requirements = never,
    SourceError = never,
    SourceRequirements = never,
  >(
    source: ApplicationLoader<
      Services,
      ApplicationError,
      Requirements,
      SourceError,
      SourceRequirements
    >,
  ): ApplicationConstruction<ApplicationError, Requirements, SourceError, SourceRequirements> {
    const handler = applicationHttpEffect(source);
    return Effect.map(
      Effect.context<ApplicationCapabilities<Requirements, SourceRequirements>>(),
      (context) => {
        const captured = captureApplicationContext<Effect.Services<typeof handler>>(context);
        return Effect.contextWith((live: Context.Context<never>) =>
          Effect.provideContext(handler, Context.merge(captured, live)),
        );
      },
    );
  }

  return { applicationHttpEffect, makeApplicationHttpEffect };
};

/** Binds the configured Effect without importing it into explicit-source hosts. */
export const configureApplication = (
  make: ApplicationAdapter["makeApplicationHttpEffect"],
  source: typeof loadConfiguredApplication,
): ConfiguredApplicationHttpEffect => {
  function makeApplicationHttpEffect<
    Definition extends ApplicationDefinition<ApplicationServices<Definition>, unknown, unknown>,
  >(): Definition extends ApplicationDefinition<
    infer _Services,
    infer ApplicationError,
    infer Requirements
  >
    ? ApplicationConstruction<ApplicationError, Requirements>
    : never;
  function makeApplicationHttpEffect() {
    return make(source);
  }
  return makeApplicationHttpEffect;
};
