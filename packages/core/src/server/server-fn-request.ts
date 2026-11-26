import { Cause, Effect, Predicate, Schema } from "effect";
import type { Scope } from "effect";
import { HttpServerRequest } from "effect/http";
import type { HttpServerError } from "effect/http";

import type { EFFRONTIdentity } from "#core/application/effront-identity.ts";
import type { AnyMiddleware } from "#core/application/middleware.ts";
import { ServerFnIdHeader } from "#core/rsc/flight.ts";
import type { RequestOutcome } from "./request-outcome.ts";
import { readServerFnBody } from "./server-fn-body.ts";
import { badRequest, bodyReadError, forbidden, requestError } from "./server-fn-request-error.ts";
import type { ServerFnRequestError } from "./server-fn-request-error.ts";
import { executeProgressive, prepareServerFnOperation } from "./server-fn-operation.ts";
import type { DecodedServerFnCall, ServerFnExecutionError } from "./server-fn-operation.ts";
import { serverFnOutcome } from "./server-fn-outcome.ts";

const ServerFnArraySizeLimit = 10_000;
// oxlint-disable-next-line rules/prefer-non-unknown-decode -- React returns an untrusted value decoded from the request body.
const decodeArguments = Schema.decodeUnknownEffect(Schema.Array(Schema.Unknown));

export { ServerFnRequestError } from "./server-fn-request-error.ts";

export type PreparedServerFnRequest<ApplicationServices> = Readonly<{
  execute: Effect.Effect<RequestOutcome, ServerFnRequestError, ApplicationServices | Scope.Scope>;
  middleware: Readonly<AnyMiddleware<ApplicationServices>[]>;
}>;

export const validateOrigin = (
  request: HttpServerRequest.HttpServerRequest,
): Effect.Effect<void, ServerFnRequestError> =>
  Effect.try({
    catch: (cause) =>
      requestError("Rejected a cross-origin Server Function request.", forbidden, cause),
    try: () => {
      const { origin } = request.headers;
      if (Predicate.isNullish(origin)) {
        throw new Cause.IllegalArgumentError("The Origin header is missing.");
      }

      const expectedHost = request.headers["host"];
      if (
        Predicate.isNullish(expectedHost) ||
        new URL(origin).host !== expectedHost.toLowerCase()
      ) {
        throw new Cause.IllegalArgumentError(
          `Origin "${origin}" does not match host "${expectedHost ?? ""}".`,
        );
      }
    },
  });

type DecodeServerFnCall = <ApplicationServices>(
  request: Request,
  actionId: string,
  identity: EFFRONTIdentity<ApplicationServices>,
) => Effect.Effect<
  DecodedServerFnCall<ApplicationServices>,
  ServerFnExecutionError | ServerFnRequestError
>;

export const decodeServerFnCall: DecodeServerFnCall = Effect.fnUntraced(
  function* (request, actionId, identity) {
    const { createTemporaryReferenceSet, decodeReply, loadServerAction } = yield* Effect.promise(
      async () => import("@vitejs/plugin-rsc/rsc/server"),
    );
    const temporaryReferences = createTemporaryReferenceSet();
    const body = yield* readServerFnBody(request);
    const decoded: unknown = yield* Effect.tryPromise({
      catch: (cause) =>
        requestError("Failed to decode Server Function arguments.", badRequest, cause),
      try: async () =>
        decodeReply(body, {
          arraySizeLimit: ServerFnArraySizeLimit,
          temporaryReferences,
        }),
    });
    const args = yield* decodeArguments(decoded).pipe(
      Effect.mapError((cause) =>
        requestError("Expected a Server Function argument array.", badRequest, cause),
      ),
    );
    const action = yield* Effect.tryPromise({
      catch: (cause) =>
        requestError("The requested Server Function does not exist.", badRequest, cause),
      try: async () => loadServerAction(actionId),
    });
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The RSC loader declares Function while the decoded argument count is request-dependent.
    const invoke = action as (...args: Readonly<unknown[]>) => unknown;
    const operation = yield* prepareServerFnOperation(identity, invoke, args);

    return { operation, temporaryReferences };
  },
);

const prepareClientServerFn = Effect.fnUntraced(function* <ApplicationServices>(
  request: Request,
  actionId: string,
  identity: EFFRONTIdentity<ApplicationServices>,
) {
  const { operation, temporaryReferences } = yield* decodeServerFnCall(request, actionId, identity);
  const prepared: PreparedServerFnRequest<ApplicationServices> = {
    execute: serverFnOutcome(operation.effect).pipe(
      Effect.map(
        (outcome) =>
          ({
            // oxlint-disable-next-line unicorn/no-null -- The Flight response contract uses null for absent form state.
            formState: null,
            ...outcome,
            temporaryReferences,
          }) satisfies RequestOutcome,
      ),
    ),
    middleware: operation.middleware,
  };
  return prepared;
});

const prepareProgressiveServerFn = Effect.fnUntraced(function* <ApplicationServices>(
  request: Request,
  identity: EFFRONTIdentity<ApplicationServices>,
) {
  const { decodeAction, decodeFormState } = yield* Effect.promise(
    async () => import("@vitejs/plugin-rsc/rsc/server"),
  );
  const body = yield* readServerFnBody(request);
  if (!(body instanceof FormData)) {
    return yield* bodyReadError(
      "Expected a multipart Server Function form body.",
      new Cause.IllegalArgumentError(
        "Expected FormData from a progressive Server Function request.",
      ),
    );
  }
  const decodedAction = yield* Effect.tryPromise({
    catch: (cause) =>
      requestError("Failed to decode the Server Function form action.", badRequest, cause),
    try: async () => decodeAction(body),
  });
  if (Predicate.isNullish(decodedAction)) {
    return yield* requestError(
      "The submitted form does not contain a Server Function action.",
      badRequest,
      new Cause.IllegalArgumentError("decodeAction returned null."),
    );
  }

  const operation = yield* prepareServerFnOperation(identity, decodedAction, []);
  const prepared: PreparedServerFnRequest<ApplicationServices> = {
    execute: executeProgressive(operation, body, decodeFormState),
    middleware: operation.middleware,
  };
  return prepared;
});

type PrepareServerFnRequest = <Services>(
  request: HttpServerRequest.HttpServerRequest,
  identity: EFFRONTIdentity<Services>,
) => Effect.Effect<
  PreparedServerFnRequest<Services>,
  HttpServerError.RequestError | ServerFnExecutionError | ServerFnRequestError,
  Scope.Scope
>;

export const prepareServerFnRequest: PrepareServerFnRequest = Effect.fnUntraced(
  function* (request, identity) {
    yield* validateOrigin(request);
    const signal = yield* Effect.abortSignal;
    const webRequest = yield* HttpServerRequest.toWeb(request, { signal });
    const actionId = request.headers[ServerFnIdHeader];
    const prepareRequest = Predicate.isNullish(actionId)
      ? prepareProgressiveServerFn(webRequest, identity)
      : prepareClientServerFn(webRequest, actionId, identity);

    return yield* prepareRequest;
  },
);

export type ServerFnRequestFailure = Effect.Error<ReturnType<typeof prepareServerFnRequest>>;
