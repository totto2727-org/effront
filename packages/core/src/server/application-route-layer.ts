import { Array, Context, Effect, Layer, Option, Predicate } from "effect";
import type { Types } from "effect";
import { HttpRouter } from "effect/http";
import type { HttpServerResponse } from "effect/http";

import type { EFFRONTIdentity } from "#core/application/effront-identity.ts";
import { getScopedHttpMiddleware } from "#core/application/middleware.ts";
import type { AnyMiddleware } from "#core/application/middleware.ts";
import type { CompiledDestination, CompiledRouteGraph } from "#core/application/route-graph.ts";
import { analyzeRoutePath } from "#core/application/route-path.ts";
import { ServerFnQueryPath } from "#core/rsc/flight.ts";
import { renderPageRequest } from "./application-render.ts";
import {
  executeServerFunction,
  executeServerFunctionQuery,
} from "./application-server-functions.ts";
import type { HttpApplicationRequirements, RequestServices } from "./application.ts";

type RouteLayer = Layer.Layer<never, never, HttpApplicationRequirements>;
// oxlint-disable-next-line typescript/explicit-function-return-type -- Native HttpRouter middleware infers its request-service markers from the implementation.
const provideRequestContext = <Services>(applicationServices: Context.Context<Services>) =>
  HttpRouter.middleware<{ provides: Services }>()(
    (httpEffect): Effect.Effect<HttpServerResponse.HttpServerResponse, Types.unhandled> =>
      Effect.flatMap(Effect.context(), (requestContext) =>
        httpEffect.pipe(Effect.provideContext(Context.merge(requestContext, applicationServices))),
      ),
  );

type RequestMiddleware<Services> = ReturnType<typeof provideRequestContext<Services>>;

// oxlint-disable-next-line typescript/explicit-function-return-type -- Native HttpRouter middleware infers which router services are already provided.
const routeParamMiddleware = (catchAll: string | null) =>
  HttpRouter.middleware()((httpEffect) =>
    Effect.gen(function* () {
      if (Predicate.isNullish(catchAll)) {
        return yield* httpEffect;
      }
      const context = yield* HttpRouter.RouteContext;
      const { "*": captured, ...parameters } = context.params;
      // Effect HTTP owns matching and decoding. Convert its wildcard key to the authored name.
      return yield* Effect.provideService(httpEffect, HttpRouter.RouteContext, {
        params: Object.freeze({ ...parameters, [catchAll]: captured ?? "" }),
        route: context.route,
      });
    }),
  );

const innermostMiddlewareCount = 1;

const pageMiddleware = <Services, Provided>(
  middleware: Readonly<AnyMiddleware<Services>[]>,
  requestContext: RequestMiddleware<Provided>,
): RequestMiddleware<Provided> =>
  Option.match(Array.last(middleware), {
    onNone: () => requestContext,
    onSome: (last) =>
      Array.reduceRight(
        Array.dropRight(middleware, innermostMiddlewareCount),
        getScopedHttpMiddleware(last),
        (combined, current) => combined.combine(getScopedHttpMiddleware(current)),
      ).combine(requestContext),
  });

const destinationRoutes = <Services>(
  identity: EFFRONTIdentity<Services>,
  destination: CompiledDestination<Services>,
  requestContext: RequestMiddleware<RequestServices<Services>>,
): RouteLayer => {
  const { catchAll, matcher } = analyzeRoutePath(destination.pattern);
  const params = routeParamMiddleware(catchAll);
  const page = HttpRouter.add("GET", matcher, (request) =>
    renderPageRequest(identity, destination, request),
  ).pipe(
    Layer.provide(pageMiddleware(destination.middleware, requestContext).combine(params).layer),
  );
  const mutation = HttpRouter.add("POST", matcher, (request) =>
    executeServerFunction(identity, destination, request),
  ).pipe(Layer.provide(requestContext.combine(params).layer));
  return Layer.mergeAll(page, mutation);
};

export const registerApplicationRoutes = <Services>(
  identity: EFFRONTIdentity<Services>,
  [first, ...remaining]: CompiledRouteGraph<Services>,
  applicationServices: Context.Context<RequestServices<Services>>,
): RouteLayer => {
  const requestContext = provideRequestContext(applicationServices);
  const query = HttpRouter.add("POST", ServerFnQueryPath, (request) =>
    executeServerFunctionQuery(identity, request),
  ).pipe(Layer.provide(requestContext.layer));
  return Layer.mergeAll(
    query,
    destinationRoutes(identity, first, requestContext),
    ...remaining.map((destination) => destinationRoutes(identity, destination, requestContext)),
  );
};
