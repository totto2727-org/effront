import { Array, Effect } from "effect";
import type { HttpServerRequest } from "effect/http";

import type { EFFRONTIdentity } from "#core/application/effront-identity.ts";
import { applyMiddleware } from "#core/application/middleware.ts";
import type { CompiledDestination } from "#core/application/route-graph.ts";
import { renderDestination } from "./application-render.ts";
import {
  flightResponse,
  serverFnRequestFailureResponse,
  withAcceptVary,
} from "./application-response.ts";
import type { MutationResponse, QueryResponse } from "./application-response.ts";
import { FlightRenderer } from "./flight-renderer.tsx";
import { prepareServerFnQuery } from "./server-fn-query.ts";
import { prepareServerFnRequest } from "./server-fn-request.ts";

export const executeServerFunction: <Services>(
  identity: EFFRONTIdentity<Services>,
  destination: CompiledDestination<Services>,
  request: HttpServerRequest.HttpServerRequest,
) => MutationResponse<Services> = Effect.fnUntraced(
  function* <Services>(
    identity: EFFRONTIdentity<Services>,
    destination: CompiledDestination<Services>,
    request: HttpServerRequest.HttpServerRequest,
  ) {
    const prepared = yield* prepareServerFnRequest(request, identity);
    const refreshMiddleware = destination.middleware.filter(
      (middleware) => !prepared.middleware.includes(middleware),
    );
    const renderMiddleware = Array.isReadonlyArrayEmpty(refreshMiddleware)
      ? prepared.middleware
      : Object.freeze([...prepared.middleware, ...refreshMiddleware]);
    const response = prepared.execute.pipe(
      Effect.flatMap((outcome) => {
        const refresh = renderDestination(identity, {
          ...outcome,
          destination,
          middleware: renderMiddleware,
          request,
        });
        return applyMiddleware(refreshMiddleware, refresh);
      }),
    );
    return yield* applyMiddleware(prepared.middleware, response);
  },
  (response) => Effect.catchTag(response, "ServerFnRequestError", serverFnRequestFailureResponse),
  withAcceptVary,
);

export const executeServerFunctionQuery: <Services>(
  identity: EFFRONTIdentity<Services>,
  request: HttpServerRequest.HttpServerRequest,
) => QueryResponse<Services> = Effect.fnUntraced(
  function* <Services>(
    identity: EFFRONTIdentity<Services>,
    request: HttpServerRequest.HttpServerRequest,
  ) {
    const prepared = yield* prepareServerFnQuery(request, identity);
    return yield* applyMiddleware(
      prepared.middleware,
      Effect.gen(function* () {
        const result = yield* prepared.execute;
        const renderer = yield* FlightRenderer;
        const flight = yield* renderer.renderQuery({
          middleware: prepared.middleware,
          renderRuntime: identity.renderRuntime,
          result,
          temporaryReferences: prepared.temporaryReferences,
        });
        return flightResponse(flight);
      }),
    );
  },
  (response) => Effect.catchTag(response, "ServerFnRequestError", serverFnRequestFailureResponse),
  withAcceptVary,
);
