import { Stream } from "effect";
import type { Cause, Effect } from "effect";
import { Atom } from "effect/reactivity";

import type { ServerFnError } from "#core/rsc/server-fn-error.ts";
import { callQuery, callQueryStream } from "./server-fn-protocol.ts";

type AnyReadable = ReadableStream<unknown>;
type NotStreaming<Output> = [Extract<Output, AnyReadable>] extends [never]
  ? unknown
  : Readonly<{ "A streaming Server Function is read with stream": never }>;
type Streaming<Output> = [Output] extends [AnyReadable]
  ? unknown
  : Readonly<{ "A non-streaming Server Function is read with query": never }>;
type StreamValue<Output> = [Output] extends [ReadableStream<infer Value>] ? Value : never;

export const query =
  <Args extends Readonly<unknown[]>, Output>(
    serverFn: ((...args: Args) => Promise<Output>) & NotStreaming<Output>,
  ) =>
  (...args: Args): Effect.Effect<Output, ServerFnError> =>
    callQuery(serverFn, args);

export const queryAtom = <Args extends Readonly<unknown[]>, Output>(
  serverFn: ((...args: Args) => Promise<Output>) & NotStreaming<Output>,
): Atom.AtomResultFn<Args, Output, ServerFnError> =>
  Atom.fn((args: Args) => callQuery(serverFn, args));

export const stream =
  <Args extends Readonly<unknown[]>, Output>(
    serverFn: ((...args: Args) => Promise<Output>) & Streaming<Output>,
  ) =>
  (...args: Args): Stream.Stream<StreamValue<Output>, ServerFnError> =>
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Streaming<Output> fixes the chunk type at the public Server Function boundary.
    Stream.unwrap(callQueryStream(serverFn, args)) as Stream.Stream<
      StreamValue<Output>,
      ServerFnError
    >;

export const streamAtom = <Args extends Readonly<unknown[]>, Output>(
  serverFn: ((...args: Args) => Promise<Output>) & Streaming<Output>,
): Atom.AtomResultFn<Args, StreamValue<Output>, ServerFnError | Cause.NoSuchElementError> =>
  Atom.fn((args: Args) => stream(serverFn)(...args));
