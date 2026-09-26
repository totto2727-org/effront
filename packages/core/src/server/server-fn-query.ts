import { Cause, Effect, Option } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import type { Scope } from "effect";
import type { createTemporaryReferenceSet } from "@vitejs/plugin-rsc/rsc/server";

import type { EFFRONTIdentity } from "../application/effront-identity";
import type { AnyMiddleware } from "../application/middleware";
import { ServerFnIdHeader, type ServerFnResult } from "../rsc/flight";
import { serverFnResponse } from "./server-fn-outcome";
import { decodeServerFnCall, ServerFnRequestError, validateOrigin } from "./server-fn-request";

export type PreparedServerFnQuery<Services> = {
  readonly execute: Effect.Effect<ServerFnResult, never, Services | Scope.Scope>;
  readonly middleware: ReadonlyArray<AnyMiddleware<Services>>;
  readonly temporaryReferences: ReturnType<typeof createTemporaryReferenceSet>;
};

const prepareServerFnQueryRaw = Effect.fnUntraced(function* <Services>(
  request: HttpServerRequest.HttpServerRequest,
  identity: EFFRONTIdentity<Services>,
) {
  yield* validateOrigin(request);
  const actionId = request.headers[ServerFnIdHeader];
  if (actionId === undefined) {
    return yield* new ServerFnRequestError({
      cause: new Error(`Missing the ${ServerFnIdHeader} header.`),
      message: "A query request must identify its Server Function.",
      status: 400,
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
  } as PreparedServerFnQuery<Services>;
});

export const prepareServerFnQuery = <Services>(
  request: HttpServerRequest.HttpServerRequest,
  identity: EFFRONTIdentity<Services>,
): Effect.Effect<PreparedServerFnQuery<Services>, ServerFnRequestError, Scope.Scope> =>
  prepareServerFnQueryRaw(request, identity).pipe(
    Effect.catchCause((cause) => {
      if (Cause.hasInterrupts(cause)) return Effect.interrupt;
      const failure = Option.getOrUndefined(Cause.findErrorOption(cause));
      return Effect.fail(
        failure instanceof ServerFnRequestError
          ? failure
          : new ServerFnRequestError({
              cause: Cause.squash(cause),
              message: "Failed to prepare the Server Function query.",
              status: 500,
            }),
      );
    }),
  );
