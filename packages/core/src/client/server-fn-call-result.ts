import { Effect, Match, Result, Schema } from "effect";
import { createTemporaryReferenceSet, encodeReply } from "@vitejs/plugin-rsc/browser";

import type { ServerFnResult } from "#core/rsc/flight.ts";
import { ServerFnDefect, ServerFnInputError } from "#core/rsc/server-fn-error.ts";
import type { ServerFnFailureModel } from "#core/rsc/server-fn-error.ts";

// oxlint-disable-next-line unicorn/throw-new-error -- The Effect Schema factory provides the error constructor.
export class ServerFnCallError extends Schema.TaggedError<ServerFnCallError>()(
  "ServerFnCallError",
  {
    cause: Schema.Defect(),
    message: Schema.String,
  },
) {}

export type ServerFnCall = Readonly<{
  args: Readonly<unknown[]>;
  id: string;
  result: PromiseWithResolvers<unknown>;
}>;

const decodeFailure = (error: ServerFnFailureModel): ServerFnInputError | ServerFnDefect =>
  Match.value(error).pipe(
    Match.tagsExhaustive({
      ServerFnDefect: ({ detail, digest }) => new ServerFnDefect({ detail, digest }),
      ServerFnInputError: ({ detail }) => new ServerFnInputError({ detail }),
    }),
  );

export const settleCall = ({ result }: ServerFnCall, reply: ServerFnResult): void => {
  const decoded = Match.value(reply).pipe(
    Match.tagsExhaustive({
      Failure: ({ error }) => Result.fail(decodeFailure(error)),
      Success: ({ value }) => Result.succeed(value),
    }),
  );
  if (Result.isFailure(decoded)) {
    result.reject(decoded.failure);
  } else {
    result.resolve(decoded.success);
  }
};

export const nativeCallError = (message: string): Error =>
  // oxlint-disable-next-line rules/require-tagged-error -- Retain the native cause of an invalid Flight reply.
  new Error(message);

export const encodeCall = Effect.fnUntraced(function* <Failure>(
  args: Readonly<unknown[]>,
  onError: (cause: unknown) => Failure,
) {
  const temporaryReferences = createTemporaryReferenceSet();
  const signal = yield* Effect.abortSignal;
  const body = yield* Effect.tryPromise({
    catch: onError,
    try: async () => encodeReply([...args], { signal, temporaryReferences }),
  });
  return { body, temporaryReferences };
});
