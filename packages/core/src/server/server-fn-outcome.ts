// Vite replaces `import.meta.env.DEV` at compile time.
import { Cause, Effect, Option } from "effect";

import { isServerFnStream } from "../application/server-fn";
import type { ServerFnResult } from "../rsc/flight";
import { ServerFnInputError, serverFnErrorDetail } from "../rsc/server-fn-error";
import type { RequestOutcome } from "./request-outcome";
import { serverFnStream } from "./server-fn-stream";
import { nextErrorDigest } from "./error-digest";

export const serverFnResponse = Effect.fnUntraced(function* <Output, Error, Requirements>(
  operation: Effect.Effect<Output, Error, Requirements>,
) {
  const exit = yield* Effect.exit(operation);
  if (exit._tag === "Success") {
    if (isServerFnStream<Requirements>(exit.value)) {
      const readable = yield* serverFnStream(exit.value);
      return { _tag: "Success", value: readable } satisfies ServerFnResult;
    }
    return { _tag: "Success", value: exit.value } satisfies ServerFnResult;
  }
  if (Cause.hasInterrupts(exit.cause)) {
    return yield* Effect.interrupt;
  }

  const error = Option.getOrUndefined(Cause.findErrorOption(exit.cause));
  if (error instanceof ServerFnInputError) {
    yield* Effect.logWarning("Server Function rejected its arguments.", error.detail.message);
    return {
      _tag: "Failure",
      error: { _tag: "ServerFnInputError", detail: error.detail },
    } satisfies ServerFnResult;
  }

  const digest = yield* nextErrorDigest;
  yield* Effect.logError("Server Function failed.", exit.cause).pipe(
    Effect.annotateLogs("serverFnDigest", digest),
  );
  return {
    _tag: "Failure",
    error: {
      _tag: "ServerFnDefect",
      detail: import.meta.env.DEV ? serverFnErrorDetail(Cause.squash(exit.cause)) : null,
      digest,
    },
  } satisfies ServerFnResult;
});

export const serverFnOutcome = Effect.fnUntraced(function* <Output, Error, Requirements>(
  operation: Effect.Effect<Output, Error, Requirements>,
) {
  return {
    serverFnResult: yield* serverFnResponse(operation),
    status: 200,
  } satisfies Pick<RequestOutcome, "serverFnResult" | "status">;
});
