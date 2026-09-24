import { Effect, FiberHandle, Scope, Stream } from "effect";

/**
 * Exposes a Server Function's stream to Flight while its producer remains owned by the
 * request scope. Flight may hold a reader lock when the request is cancelled, so
 * cancelling the ReadableStream alone cannot be relied on to finish its finalizers.
 */
export const serverFnStream = Effect.fnUntraced(function* <Value, Error, Services>(
  source: Stream.Stream<Value, Error, Services>,
): Effect.fn.Return<ReadableStream<Value>, never, Services | Scope.Scope> {
  const producer = yield* FiberHandle.make();
  // Register before any application stream work starts. Closing the request scope
  // interrupts and joins this fiber, including asynchronous producer finalizers.
  return yield* Stream.toReadableStreamEffect(
    Stream.onStart(
      source,
      Effect.withFiber((fiber) => FiberHandle.set(producer, fiber)),
    ),
  );
});
