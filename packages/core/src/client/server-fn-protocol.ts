import { Deferred, Effect, Predicate, Schema, Stream } from "effect";

import {
  serverFnErrorDetail,
  ServerFnDefect,
  ServerFnInputError,
  ServerFnTransportError,
} from "../rsc/server-fn-error.ts";
import type { ServerFnError } from "../rsc/server-fn-error.ts";

const isServerFnError = Schema.is(
  Schema.Union([ServerFnDefect, ServerFnInputError, ServerFnTransportError]),
);
const ServerFnQueryTypeId: unique symbol = Symbol.for("effront/ServerFnQuery");
const QueryOptions = Schema.Union([
  Schema.TaggedStruct("Query", { signal: Schema.instanceOf(AbortSignal) }),
  Schema.TaggedStruct("Stream", {
    signal: Schema.instanceOf(AbortSignal),
    completed: Schema.declare(Deferred.isDeferred<void, ServerFnError>),
  }),
]);
const isQueryOptions = Schema.is(QueryOptions);

export type MatchedQuery = typeof QueryOptions.Type &
  Readonly<{
    args: Readonly<unknown[]>;
  }>;

export const matchServerFnQuery = (args: Readonly<unknown[]>): MatchedQuery | null => {
  const last = args.at(-1);
  try {
    if (typeof last !== "object" || last === null || !(ServerFnQueryTypeId in last)) {
      return null;
    }
    const options = last[ServerFnQueryTypeId];
    return isQueryOptions(options) ? { ...options, args: args.slice(0, -1) } : null;
  } catch {
    return null;
  }
};

export const transportError = (cause: unknown): ServerFnTransportError =>
  new ServerFnTransportError({ detail: serverFnErrorDetail(cause) });

export const invocationError = (cause: unknown): ServerFnError =>
  isServerFnError(cause) ? cause : transportError(cause);

const streamError = (cause: unknown): ServerFnError =>
  Predicate.hasProperty(cause, "digest") && typeof cause.digest === "string"
    ? new ServerFnDefect({ detail: serverFnErrorDetail(cause), digest: cause.digest })
    : transportError(cause);

const invoke = <Args extends Readonly<unknown[]>>(
  serverFn: (...args: Args) => Promise<unknown>,
  args: Args,
  options: typeof QueryOptions.Type,
) =>
  (serverFn as (...args: Readonly<unknown[]>) => Promise<unknown>)(...args, {
    [ServerFnQueryTypeId]: options,
  });

export const callQuery = <Args extends Readonly<unknown[]>, Output>(
  serverFn: (...args: Args) => Promise<Output>,
  args: Args,
): Effect.Effect<Output, ServerFnError> =>
  Effect.tryPromise({
    catch: invocationError,
    try: (signal) => invoke(serverFn, args, { _tag: "Query", signal }) as Promise<Output>,
  });

export const callQueryStream = Effect.fnUntraced(function* <Args extends Readonly<unknown[]>>(
  serverFn: (...args: Args) => Promise<unknown>,
  args: Args,
) {
  const signal = yield* Effect.abortSignal;
  const completed = yield* Deferred.make<void, ServerFnError>();
  const value = yield* Effect.tryPromise({
    catch: invocationError,
    try: () => invoke(serverFn, args, { _tag: "Stream", signal, completed }),
  });
  return Stream.fromReadableStream({
    evaluate: () => value as ReadableStream<unknown>,
    onError: streamError,
  }).pipe(Stream.onEnd(Deferred.await(completed)));
});
