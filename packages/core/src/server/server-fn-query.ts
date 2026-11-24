import { Cause, Effect, Option, Predicate } from "effect";
import { HttpServerRequest } from "effect/http";
import type { Scope } from "effect";
import type { createTemporaryReferenceSet } from "@vitejs/plugin-rsc/rsc/server";

import type { EFFRONTIdentity } from "#core/application/effront-identity.ts";
import type { AnyMiddleware } from "#core/application/middleware.ts";
import { ServerFnIdHeader } from "#core/rsc/flight.ts";
import type { ServerFnResult } from "#core/rsc/flight.ts";
import { serverFnResponse } from "./server-fn-outcome.ts";
import {
  badRequest,
  internalServerError,
  ServerFnRequestError,
} from "./server-fn-request-error.ts";
import { decodeServerFnCall, validateOrigin } from "./server-fn-request.ts";

export type PreparedServerFnQuery<Services> = Readonly<{
  execute: Effect.Effect<ServerFnResult, never, Services | Scope.Scope>;
  middleware: Readonly<AnyMiddleware<Services>[]>;
  temporaryReferences: ReturnType<typeof createTemporaryReferenceSet>;
}>;

const prepareServerFnQueryRaw = Effect.fnUntraced(function* <Services>(
  request: HttpServerRequest.HttpServerRequest,
  identity: EFFRONTIdentity<Services>,
) {
  yield* validateOrigin(request);
  const actionId = request.headers[ServerFnIdHeader];
  if (Predicate.isNullish(actionId)) {
    return yield* new ServerFnRequestError({
      cause: new Cause.IllegalArgumentError(`Missing the ${ServerFnIdHeader} header.`),
      message: "A query request must identify its Server Function.",
      status: badRequest,
    });
  }

  const signal = yield* Effect.abortSignal;
  const webRequest = yield* HttpServerRequest.toWeb(request, { signal });
  const { operation, temporaryReferences } = yield* decodeServerFnCall(
    webRequest,
    actionId,
    identity,
  );
  return {
    execute: serverFnResponse(operation.effect),
    middleware: operation.middleware,
    temporaryReferences,
  } satisfies PreparedServerFnQuery<Services>;
});

export const prepareServerFnQuery = <Services>(
  request: HttpServerRequest.HttpServerRequest,
  identity: EFFRONTIdentity<Services>,
): Effect.Effect<PreparedServerFnQuery<Services>, ServerFnRequestError, Scope.Scope> =>
  prepareServerFnQueryRaw(request, identity).pipe(
    Effect.catchCause((cause) => {
      if (Cause.hasInterrupts(cause)) {
        return Effect.interrupt;
      }
      const failure = Option.getOrUndefined(Cause.findErrorOption(cause));
      return Effect.fail(
        failure instanceof ServerFnRequestError
          ? failure
          : new ServerFnRequestError({
              cause: Cause.squash(cause),
              message: "Failed to prepare the Server Function query.",
              status: internalServerError,
            }),
      );
    }),
  );
