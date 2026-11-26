import { Effect, Scope } from "effect";

export const recordedScope = Effect.fnUntraced(function* (events: string[]) {
  const parent = yield* Effect.scope;
  const scope = yield* Scope.fork(parent);
  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      events.push("request released");
    }),
  ).pipe(Scope.provide(scope));
  return scope;
});

export const producerFinalizer = (events: string[]): Effect.Effect<void> =>
  Effect.sync(() => {
    events.push("producer finalized");
  });

export const readChunk = <A>(
  reader: ReadableStreamDefaultReader<A>,
): Effect.Effect<Awaited<ReturnType<ReadableStreamDefaultReader<A>["read"]>>> =>
  Effect.promise(async () => reader.read());
