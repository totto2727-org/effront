import { Cause, Data, Effect, Exit, Option } from "effect";

import { isServerFnStream } from "#core/application/server-fn.ts";
import type { ServerFnResult } from "#core/rsc/flight.ts";
import { ServerFnInputError, serverFnErrorDetail } from "#core/rsc/server-fn-error.ts";
import type { ServerFnFailureModel } from "#core/rsc/server-fn-error.ts";
import { nextErrorDigest } from "./error-digest.ts";
import { responseOk } from "./request-outcome.ts";
import type { RequestOutcome } from "./request-outcome.ts";
import { serverFnStream } from "./server-fn-stream.ts";

const result = Data.taggedEnum<ServerFnResult>();
const { ServerFnInputError: inputFailure, ServerFnDefect: defectFailure } =
  Data.taggedEnum<ServerFnFailureModel>();

const successResponse = Effect.fnUntraced(function* <Requirements>(value: unknown) {
  if (isServerFnStream<Requirements>(value)) {
    return result.Success({ value: yield* serverFnStream(value) });
  }
  return result.Success({ value });
});

const failureResponse = Effect.fnUntraced(function* <Error>(cause: Cause.Cause<Error>) {
  if (Cause.hasInterrupts(cause)) {
    return yield* Effect.interrupt;
  }

  const error = Option.getOrUndefined(Cause.findErrorOption(cause));
  if (error instanceof ServerFnInputError) {
    yield* Effect.logWarning("Server Function rejected its arguments.", error.detail.message);
    return result.Failure({ error: inputFailure({ detail: error.detail }) });
  }

  const digest = yield* nextErrorDigest;
  yield* Effect.logError("Server Function failed.", cause).pipe(
    Effect.annotateLogs("serverFnDigest", digest),
  );
  // oxlint-disable-next-line unicorn/no-null -- Production uses the Flight failure model's null detail to omit the defect.
  const detail = import.meta.env.DEV ? serverFnErrorDetail(Cause.squash(cause)) : null;
  return result.Failure({ error: defectFailure({ detail, digest }) });
});

export const serverFnResponse = Effect.fnUntraced(function* <Output, Error, Requirements>(
  operation: Effect.Effect<Output, Error, Requirements>,
) {
  const exit = yield* Effect.exit(operation);
  return yield* Exit.isSuccess(exit)
    ? successResponse<Requirements>(exit.value)
    : failureResponse(exit.cause);
});

export const serverFnOutcome = Effect.fnUntraced(function* <Output, Error, Requirements>(
  operation: Effect.Effect<Output, Error, Requirements>,
) {
  return {
    serverFnResult: yield* serverFnResponse(operation),
    status: responseOk,
  } satisfies Pick<RequestOutcome, "serverFnResult" | "status">;
});
