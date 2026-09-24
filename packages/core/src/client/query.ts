import { type Cause, type Effect, Stream } from "effect";
import { Atom } from "effect/unstable/reactivity";

import type { ServerFnError } from "../rsc/server-fn-error";
import { callQuery, callQueryStream } from "./server-fn-protocol";

type AnyReadable = ReadableStream<unknown>;
type NotStreaming<Output> = [Extract<Output, AnyReadable>] extends [never]
  ? unknown
  : { readonly "A streaming Server Function is read with stream": never };
type Streaming<Output> = [Output] extends [AnyReadable]
  ? unknown
  : { readonly "A non-streaming Server Function is read with query": never };
type StreamValue<Output> = [Output] extends [ReadableStream<infer Value>] ? Value : never;

export const query =
  <Args extends ReadonlyArray<unknown>, Output>(
    serverFn: ((...args: Args) => Promise<Output>) & NotStreaming<Output>,
  ) =>
  (...args: Args): Effect.Effect<Output, ServerFnError> =>
    callQuery(serverFn, args);

export const queryAtom = <Args extends ReadonlyArray<unknown>, Output>(
  serverFn: ((...args: Args) => Promise<Output>) & NotStreaming<Output>,
): Atom.AtomResultFn<Args, Output, ServerFnError> =>
  Atom.fn((args: Args) => callQuery(serverFn, args));

export const stream =
  <Args extends ReadonlyArray<unknown>, Output>(
    serverFn: ((...args: Args) => Promise<Output>) & Streaming<Output>,
  ) =>
  (...args: Args): Stream.Stream<StreamValue<Output>, ServerFnError> =>
    Stream.unwrap(callQueryStream(serverFn, args)) as Stream.Stream<
      StreamValue<Output>,
      ServerFnError
    >;

export const streamAtom = <Args extends ReadonlyArray<unknown>, Output>(
  serverFn: ((...args: Args) => Promise<Output>) & Streaming<Output>,
): Atom.AtomResultFn<Args, StreamValue<Output>, ServerFnError | Cause.NoSuchElementError> =>
  Atom.fn((args: Args) => stream(serverFn)(...args));
