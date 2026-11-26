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
import { Context, Effect, Layer, Predicate, Scope } from "effect";
import { HttpRouter, HttpServerRequest } from "effect/http";

import type { loadConfiguredApplication } from "./application-loader.ts";

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

/** Resolves an application for the current Worker request. */
export type ApplicationLoader<Services, ApplicationError, Requirements> = () => Promise<
  ApplicationDefinition<Services, ApplicationError, Requirements>
>;

type ApplicationHttpEffect<ApplicationError, Requirements, Captured> = Effect.Effect<
  Effect.Success<HttpApplicationEffect<ApplicationError, Requirements>>,
  Effect.Error<HttpApplicationEffect<ApplicationError, Requirements>>,
  Exclude<
    Effect.Services<HttpApplicationEffect<ApplicationError, Requirements>>,
    Exclude<Captured, HostServices>
  >
>;

type ApplicationCapabilities<Requirements> = Exclude<
  Effect.Services<HttpApplicationEffect<never, Requirements>>,
  HostServices
>;

type ApplicationConstruction<ApplicationError, Requirements> = Effect.Effect<
  ApplicationHttpEffect<ApplicationError, Requirements, ApplicationCapabilities<Requirements>>,
  never,
  ApplicationCapabilities<Requirements>
>;

/** Keeps declaration emission on named contracts and canonical public provider imports. */
export type ApplicationAdapter = Readonly<{
  applicationHttpEffect: {
    <Services, ApplicationError, Requirements, Captured>(
      load: ApplicationLoader<Services, ApplicationError, Requirements>,
      options: Readonly<{ context: Context.Context<Captured> }>,
    ): ApplicationHttpEffect<ApplicationError, Requirements, Captured>;
    <Services, ApplicationError, Requirements, Captured = never>(
      load: ApplicationLoader<Services, ApplicationError, Requirements>,
      options?: Readonly<{ context?: Context.Context<Captured> }>,
    ): HttpApplicationEffect<ApplicationError, Requirements>;
  };
  makeApplicationHttpEffect: <Services, ApplicationError, Requirements>(
    load: ApplicationLoader<Services, ApplicationError, Requirements>,
  ) => ApplicationConstruction<ApplicationError, Requirements>;
}>;

export type ConfiguredApplicationHttpEffect = <
  Definition extends ApplicationDefinition<ApplicationServices<Definition>, unknown, unknown>,
>() => Definition extends ApplicationDefinition<
  infer _Services,
  infer ApplicationError,
  infer Requirements
>
  ? ApplicationConstruction<ApplicationError, Requirements>
  : never;

const requestHandler = <Services, ApplicationError, Requirements>(
  toHttpEffect: typeof CoreHttpEffect,
  load: ApplicationLoader<Services, ApplicationError, Requirements>,
): HttpApplicationEffect<ApplicationError, Requirements> =>
  Effect.gen(function* () {
    const application = yield* Effect.promise(load);
    return yield* toHttpEffect(application);
  });

export const makeApplicationAdapter = (toHttpEffect: typeof CoreHttpEffect): ApplicationAdapter => {
  // Load the application during the request. The host keeps its scope until the body ends.
  function applicationHttpEffect<Services, ApplicationError, Requirements, Captured>(
    load: ApplicationLoader<Services, ApplicationError, Requirements>,
    options: Readonly<{ context: Context.Context<Captured> }>,
  ): ApplicationHttpEffect<ApplicationError, Requirements, Captured>;
  function applicationHttpEffect<Services, ApplicationError, Requirements, Captured = never>(
    load: ApplicationLoader<Services, ApplicationError, Requirements>,
    options?: Readonly<{ context?: Context.Context<Captured> }>,
  ): HttpApplicationEffect<ApplicationError, Requirements>;
  function applicationHttpEffect<Services, ApplicationError, Requirements, Captured>(
    load: ApplicationLoader<Services, ApplicationError, Requirements>,
    options?: Readonly<{ context?: Context.Context<Captured> }>,
  ):
    | HttpApplicationEffect<ApplicationError, Requirements>
    | ApplicationHttpEffect<ApplicationError, Requirements, Captured> {
    const handler = requestHandler(toHttpEffect, load);
    const context = options?.context;
    // oxlint-disable-next-line rules/prefer-is-nullish -- An omitted capture uses the host context; an explicit invalid context remains a defect.
    if (Predicate.isUndefined(context)) {
      return handler;
    }
    const captured = omitHostServices(context);
    return Effect.contextWith((live: Context.Context<never>) =>
      Effect.provideContext(handler, Context.merge(captured, live)),
    );
  }

  // Capture references while the Worker is constructed. Request services are supplied by Alchemy.
  const makeApplicationHttpEffect = <Services, ApplicationError, Requirements>(
    load: ApplicationLoader<Services, ApplicationError, Requirements>,
  ): ApplicationConstruction<ApplicationError, Requirements> =>
    Effect.map(Effect.context<ApplicationCapabilities<Requirements>>(), (context) =>
      applicationHttpEffect(load, { context }),
    );

  return { applicationHttpEffect, makeApplicationHttpEffect };
};

/**
 * Binds the configured entry for owners of the application loader.
 * @param {ApplicationAdapter["makeApplicationHttpEffect"]} make - The native HTTP construction function.
 * @param {typeof loadConfiguredApplication} load - The configured application loader.
 * @returns {ConfiguredApplicationHttpEffect} The construction effect with the configured loader bound.
 */
export const configureApplication = (
  make: ApplicationAdapter["makeApplicationHttpEffect"],
  load: typeof loadConfiguredApplication,
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
  function makeApplicationHttpEffect(): ReturnType<
    ApplicationAdapter["makeApplicationHttpEffect"]
  > {
    return make(load);
  }
  return makeApplicationHttpEffect;
};
