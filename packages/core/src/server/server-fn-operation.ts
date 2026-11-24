import type {
  createTemporaryReferenceSet,
  decodeFormState as decodeReactFormState,
} from "@vitejs/plugin-rsc/rsc/server";
import { Cause, Effect, Match, Schema } from "effect";

import type { EFFRONTIdentity } from "#core/application/effront-identity.ts";
import type { AnyMiddleware } from "#core/application/middleware.ts";
import { matchServerFnInvocation } from "#core/application/server-fn.ts";
import type { ServerFnOperationError } from "#core/application/server-fn.ts";
import type { ServerFnInputError } from "#core/rsc/server-fn-error.ts";
import type { RequestOutcome } from "./request-outcome.ts";
import { internalServerError, requestError } from "./server-fn-request-error.ts";
import type { ServerFnRequestError } from "./server-fn-request-error.ts";

const noMiddleware = Object.freeze([]);
const ok = 200;

// oxlint-disable-next-line unicorn/throw-new-error -- Effect’s schema error builder supplies the base class.
export class ServerFnExecutionError extends Schema.TaggedError<ServerFnExecutionError>()(
  "ServerFnExecutionError",
  { cause: Schema.Defect() },
) {}

const normalizeServerFnFailure = <Output, Error, Services>(
  effect: Effect.Effect<Output, Error, Services>,
): Effect.Effect<Output, ServerFnExecutionError, Services> =>
  effect.pipe(
    Effect.catchCause((cause) =>
      Cause.hasInterrupts(cause)
        ? Effect.interrupt
        : Effect.fail(new ServerFnExecutionError({ cause: Cause.squash(cause) })),
    ),
  );

export type ServerFnOperation<ApplicationServices> = Readonly<{
  effect: Effect.Effect<
    unknown,
    ServerFnExecutionError | ServerFnInputError | ServerFnOperationError,
    ApplicationServices
  >;
  middleware: Readonly<AnyMiddleware<ApplicationServices>[]>;
}>;

export interface DecodedServerFnCall<ApplicationServices> {
  operation: ServerFnOperation<ApplicationServices>;
  temporaryReferences: ReturnType<typeof createTemporaryReferenceSet>;
}

export const prepareServerFnOperation = <ApplicationServices>(
  identity: EFFRONTIdentity<ApplicationServices>,
  action: (...args: Readonly<unknown[]>) => unknown,
  args: Readonly<unknown[]>,
): Effect.Effect<ServerFnOperation<ApplicationServices>, ServerFnExecutionError> =>
  Effect.sync(() => {
    const invocation = action(...args);
    return Match.value(matchServerFnInvocation(invocation, identity)).pipe(
      Match.tagsExhaustive({
        IdentityMismatch: () => ({
          effect: Effect.die(
            new Cause.IllegalArgumentError(
              "Server Function was created by a different EFFRONT module.",
            ),
          ),
          middleware: noMiddleware,
        }),
        Match: ({ effect, middleware }) => ({ effect, middleware }),
        Native: () => ({
          effect: normalizeServerFnFailure(Effect.promise(async () => await invocation)),
          middleware: noMiddleware,
        }),
      }),
    );
  }).pipe(normalizeServerFnFailure);

export const executeProgressive = <ApplicationServices>(
  operation: ServerFnOperation<ApplicationServices>,
  formData: FormData,
  decodeFormState: typeof decodeReactFormState,
): Effect.Effect<RequestOutcome, ServerFnRequestError, ApplicationServices> =>
  Effect.gen(function* () {
    const actionResult = yield* operation.effect.pipe(
      Effect.catchCause((cause) =>
        Cause.hasInterrupts(cause)
          ? Effect.interrupt
          : Effect.fail(
              requestError(
                "The Server Function form action failed.",
                internalServerError,
                Cause.squash(cause),
              ),
            ),
      ),
    );
    const decodedFormState = yield* Effect.tryPromise({
      catch: (cause) =>
        requestError("Failed to decode React form state.", internalServerError, cause),
      try: async () => decodeFormState(actionResult, formData),
    });

    return {
      // oxlint-disable-next-line unicorn/no-null -- The Flight response contract uses null for absent form state.
      formState: decodedFormState ?? null,
      // oxlint-disable-next-line unicorn/no-null -- The progressive protocol uses null because the result is passed to React form state.
      serverFnResult: null,
      status: ok,
    } satisfies RequestOutcome;
  });
