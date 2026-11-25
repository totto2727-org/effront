import { Context, Effect } from "effect";
import { HttpEffect } from "effect/http";
import type { HttpRouter, HttpServerRequest } from "effect/http";

import type { ApplicationDefinition } from "./application/definition.tsx";
import { toHttpEffect } from "./http.ts";

/**
 * Per-request values supplied by a Fetch host.
 *
 * Environment bindings intentionally stay in the Effect context. EFFRONT never adds
 * them to Flight or HTML payloads.
 */
// oxlint-disable-next-line eslint/no-redeclare -- The public Workers API pairs the value type with its same-named Context reference.
export type WorkersRequestContext<Env, ExecutionContext> = Readonly<{
  env: Env;
  executionContext: ExecutionContext;
  request: Request;
}>;

export const WorkersRequestContext = Context.Reference<WorkersRequestContext<unknown, unknown>>(
  "effront/workers/WorkersRequestContext",
  {
    defaultValue: () => {
      // oxlint-disable-next-line rules/require-tagged-error -- Callers outside a Fetch request receive the native TypeError contract.
      throw new TypeError(
        "Workers request context is only available while handling a Fetch request.",
      );
    },
  },
);

interface WorkersContextAccessors<Env, ExecutionContext> {
  getWorkersEnv: () => Effect.Effect<Env>;
  getWorkersRequestContext: () => Effect.Effect<WorkersRequestContext<Env, ExecutionContext>>;
}

// oxlint-disable typescript/no-unnecessary-type-parameters -- Callers choose their declared Fetch host types for the returned context.
export const getWorkersRequestContext = <
  Env = unknown,
  ExecutionContext = unknown,
>(): Effect.Effect<WorkersRequestContext<Env, ExecutionContext>> =>
  Effect.map(
    WorkersRequestContext,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The Fetch host supplies the binding types declared by its reader.
    (context) => context as WorkersRequestContext<Env, ExecutionContext>,
  );
// oxlint-enable typescript/no-unnecessary-type-parameters

export const getWorkersEnv = <Env = unknown>(): Effect.Effect<Env> =>
  Effect.map(getWorkersRequestContext<Env>(), ({ env }) => env);

/**
 * Creates typed readers for the existing request context, without creating a new service or Layer.
 * Types describe host-supplied values; they do not validate them at runtime.
 * @returns {WorkersContextAccessors<Env, ExecutionContext>} Readers for the environment and complete request context.
 */
export const createWorkersContextAccessors = <
  Env = unknown,
  ExecutionContext = unknown,
>(): WorkersContextAccessors<Env, ExecutionContext> => ({
  getWorkersEnv: () => getWorkersEnv<Env>(),
  getWorkersRequestContext: () => getWorkersRequestContext<Env, ExecutionContext>(),
});

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
 * @param {ApplicationDefinition<Services, ApplicationError, HttpRouter.HttpRouter | HttpServerRequest.HttpServerRequest>} application The Effront application whose services are acquired per request.
 * @returns {FetchHandler} The native Fetch handler for the current host request.
 */
export const createFetchHandler = <Services, ApplicationError>(
  application: ApplicationDefinition<
    Services,
    ApplicationError,
    HttpRouter.HttpRouter | HttpServerRequest.HttpServerRequest
  >,
): FetchHandler => {
  const handler = HttpEffect.toWebHandler(toHttpEffect(application));
  return async (request, env, executionContext) =>
    handler(request, Context.make(WorkersRequestContext, { env, executionContext, request }));
};
