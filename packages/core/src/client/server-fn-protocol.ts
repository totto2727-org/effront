import { Effect, Schema } from "effect";

import {
  type ServerFnError,
  serverFnErrorDetail,
  ServerFnDefect,
  ServerFnInputError,
  ServerFnTransportError,
} from "../rsc/server-fn-error";

const isServerFnError = Schema.is(Schema.Union([ServerFnDefect, ServerFnInputError, ServerFnTransportError]));
const ServerFnQueryTypeId: unique symbol = Symbol.for("effront/ServerFnQuery");
const isQueryOptions = Schema.is(Schema.Struct({ signal: Schema.instanceOf(AbortSignal) }));

export type MatchedQuery = {
  readonly args: ReadonlyArray<unknown>;
  readonly signal: AbortSignal;
};

export const matchServerFnQuery = (args: ReadonlyArray<unknown>): MatchedQuery | null => {
  const last = args.at(-1);
  try {
    if (typeof last !== "object" || last === null || !(ServerFnQueryTypeId in last)) {
      return null;
    }
    const options = last[ServerFnQueryTypeId];
    return isQueryOptions(options) ? { args: args.slice(0, -1), signal: options.signal } : null;
  } catch {
    return null;
  }
};

export const transportError = (cause: unknown) =>
  new ServerFnTransportError({ detail: serverFnErrorDetail(cause) });

export const invocationError = (cause: unknown): ServerFnError =>
  isServerFnError(cause) ? cause : transportError(cause);

export const callQuery = <Args extends ReadonlyArray<unknown>, Output>(
  serverFn: (...args: Args) => Promise<Output>,
  args: Args,
): Effect.Effect<Output, ServerFnError> =>
  Effect.tryPromise({
    try: (signal) =>
      (serverFn as (...args: ReadonlyArray<unknown>) => Promise<Output>)(...args, {
        [ServerFnQueryTypeId]: { signal },
      }),
    catch: invocationError,
  });
