import { Array, Deferred, Effect, Option, Predicate, Schema, Stream } from "effect";

import {
  serverFnErrorDetail,
  ServerFnDefect,
  ServerFnInputError,
  ServerFnTransportError,
} from "#core/rsc/server-fn-error.ts";
import type { ServerFnError } from "#core/rsc/server-fn-error.ts";

type Completed = Effect.Success<typeof Effect.void>;

const isServerFnError = Schema.is(
  Schema.Union([ServerFnDefect, ServerFnInputError, ServerFnTransportError]),
);
const ServerFnQueryTypeId: unique symbol = Symbol.for("effront/ServerFnQuery");
const Query = Schema.TaggedStruct("Query", { signal: Schema.instanceOf(AbortSignal) });
const StreamingQuery = Schema.TaggedStruct("Stream", {
  completed: Schema.declare(Deferred.isDeferred<Completed, ServerFnError>),
  signal: Schema.instanceOf(AbortSignal),
});
const QueryOptions = Schema.Union([Query, StreamingQuery]);
const isQueryOptions = Schema.is(QueryOptions);
const queryMarkerCount = 1;

export type MatchedQuery = typeof QueryOptions.Type &
  Readonly<{
    args: Readonly<unknown[]>;
  }>;

const matchQueryMarker = (
  last: unknown,
  args: Readonly<unknown[]>,
): Option.Option<MatchedQuery> => {
  try {
    if (Predicate.isFunction(last) || !Predicate.hasProperty(last, ServerFnQueryTypeId)) {
      return Option.none();
    }
    const options = last[ServerFnQueryTypeId];
    return isQueryOptions(options)
      ? Option.some({ ...options, args: Array.dropRight(args, queryMarkerCount) })
      : Option.none();
  } catch {
    // Reading a caller's getter can throw. Only valid query metadata may be stripped.
    return Option.none();
  }
};

export const matchServerFnQuery = (args: Readonly<unknown[]>): MatchedQuery | undefined =>
  Array.last(args).pipe(
    Option.flatMap((last) => matchQueryMarker(last, args)),
    Option.getOrUndefined,
  );

export const transportError = (cause: unknown): ServerFnTransportError =>
  new ServerFnTransportError({ detail: serverFnErrorDetail(cause) });

export const invocationError = (cause: unknown): ServerFnError =>
  isServerFnError(cause) ? cause : transportError(cause);

const streamError = (cause: unknown): ServerFnError =>
  Predicate.hasProperty(cause, "digest") && Predicate.isString(cause.digest)
    ? new ServerFnDefect({ detail: serverFnErrorDetail(cause), digest: cause.digest })
    : transportError(cause);

const invoke = async <Args extends Readonly<unknown[]>, Output>(
  serverFn: (...args: Args) => Promise<Output>,
  args: Args,
  options: typeof QueryOptions.Type,
): Promise<Output> =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- React's proxy takes a framework marker after the caller's typed arguments.
  (serverFn as (...args: Readonly<unknown[]>) => Promise<Output>)(...args, {
    [ServerFnQueryTypeId]: options,
  });

export const callQuery = <Args extends Readonly<unknown[]>, Output>(
  serverFn: (...args: Args) => Promise<Output>,
  args: Args,
): Effect.Effect<Output, ServerFnError> =>
  Effect.tryPromise({
    catch: invocationError,
    try: async (signal) => invoke(serverFn, args, Query.make({ signal })),
  });

export const callQueryStream = Effect.fnUntraced(function* <Args extends Readonly<unknown[]>>(
  serverFn: (...args: Args) => Promise<unknown>,
  args: Args,
) {
  const signal = yield* Effect.abortSignal;
  const completed = yield* Deferred.make<Completed, ServerFnError>();
  const options = StreamingQuery.make({ completed, signal });
  const value = yield* Effect.tryPromise({
    catch: invocationError,
    try: async () => invoke(serverFn, args, options),
  });
  return Stream.fromReadableStream({
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The public streaming API requires a native ReadableStream which React reconstructs.
    evaluate: () => value as ReadableStream<unknown>,
    onError: streamError,
  }).pipe(Stream.onEnd(Deferred.await(completed)));
});
