import { Context, Effect } from "effect";
import { HttpEffect, type HttpRouter, type HttpServerRequest } from "effect/unstable/http";

import type { ApplicationDefinition } from "./application/definition";
import { toHttpEffect } from "./http";

/**
 * Per-request values supplied by a Fetch host.
 *
 * Environment bindings intentionally stay in the Effect context. EFFRONT never adds
 * them to Flight or HTML payloads.
 */
export type WorkersRequestContext<Env, ExecutionContext> = {
  readonly env: Env;
  readonly executionContext: ExecutionContext;
  readonly request: Request;
};

export const WorkersRequestContext = Context.Reference<WorkersRequestContext<unknown, unknown>>(
  "effront/workers/WorkersRequestContext",
  {
    defaultValue: () => {
      throw new TypeError(
        "Workers request context is only available while handling a Fetch request.",
      );
    },
  },
);

/**
 * Creates typed readers for the existing request context, without creating a new service or Layer.
 * Types describe host-supplied values; they do not validate them at runtime.
 */
export const createWorkersContextAccessors = <Env = unknown, ExecutionContext = unknown>() => {
  const getWorkersRequestContext = () =>
    Effect.map(
      WorkersRequestContext,
      (context) => context as WorkersRequestContext<Env, ExecutionContext>,
    );

  const getWorkersEnv = () => Effect.map(getWorkersRequestContext(), (context) => context.env);

  return { getWorkersEnv, getWorkersRequestContext };
};

export const getWorkersEnv = <Env = unknown>() =>
  createWorkersContextAccessors<Env>().getWorkersEnv();

export const getWorkersRequestContext = <Env = unknown, ExecutionContext = unknown>() =>
  createWorkersContextAccessors<Env, ExecutionContext>().getWorkersRequestContext();

export type FetchHandler<Env = unknown, ExecutionContext = unknown> = (
  request: Request,
  env: Env,
  executionContext: ExecutionContext,
) => Promise<Response>;

/**
 * Creates a Workers-compatible Fetch handler.
 *
 * The application Layer is deliberately built for every request. This lets page
 * and middleware services read that request's environment bindings during layer
 * acquisition, and the resulting scope remains alive until the response body
 * reaches EOF, errors, or is cancelled.
 */
export const createFetchHandler = <Services, ApplicationError>(
  application: ApplicationDefinition<
    Services,
    ApplicationError,
    HttpRouter.HttpRouter | HttpServerRequest.HttpServerRequest
  >,
): FetchHandler => {
  const handler = HttpEffect.toWebHandler(toHttpEffect(application));
  return (request, env, executionContext) =>
    handler(request, Context.make(WorkersRequestContext, { env, executionContext, request }));
};
