import type { ApplicationDefinition } from "@effront/core";
import type { HttpApplicationEffect } from "@effront/core/http";
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
import { HttpRouter, HttpServerRequest } from "effect/unstable/http";

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

/** A deferred RSC application import, evaluated only inside a Worker request. */
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

/**
 * Builds a native HTTP effect without loading React or the application during construction.
 *
 * The supplied context holds constructed capabilities, such as Alchemy KV clients.
 * Live request services take precedence, and a construction-time scope or execution
 * context is never restored. Application layers are acquired in the host's request
 * scope, which Alchemy retains through streaming response completion or cancellation.
 */
export const applicationHttpEffect = <Services, ApplicationError, Requirements, Captured = never>(
  load: ApplicationLoader<Services, ApplicationError, Requirements>,
  options: { readonly context?: Context.Context<Captured> } = {},
): ApplicationHttpEffect<ApplicationError, Requirements, Captured> => {
  const captured = omitHostServices(options.context ?? Context.empty());
  const handler = Effect.gen(function* () {
    const { toHttpEffect } = yield* Effect.promise(() => import("@effront/core/http"));
    const application = yield* Effect.promise(load);
    return yield* toHttpEffect(application);
  });
  type HandlerRequirements = Effect.Services<typeof handler>;
  type LiveRequirements = Exclude<HandlerRequirements, Exclude<Captured, HostServices>>;

  return Effect.contextWith((live: Context.Context<LiveRequirements>) =>
    Effect.provideContext(
      handler,
      Context.merge(captured, live) as Context.Context<HandlerRequirements>,
    ),
  );
};

/**
 * Captures application capabilities during Alchemy Worker construction.
 *
 * Supply only application services here. RuntimeContext, the HTTP request, and the
 * request scope are supplied by Alchemy when the returned fetch effect executes.
 * Capturing references does not acquire services or extend their lifetime.
 */
export const makeApplicationHttpEffect = <Services, ApplicationError, Requirements>(
  load: ApplicationLoader<Services, ApplicationError, Requirements>,
) =>
  Effect.map(
    Effect.context<
      Exclude<Effect.Services<HttpApplicationEffect<ApplicationError, Requirements>>, HostServices>
    >(),
    (context) => applicationHttpEffect(load, { context }),
  );
