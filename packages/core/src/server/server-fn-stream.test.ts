import { assert, expect, it } from "@effect/vitest";
import {
  Cause,
  Deferred,
  Effect,
  Exit,
  Fiber,
  Option,
  Predicate,
  Ref,
  Scope,
  Stream,
} from "effect";

import { serverFnStream } from "./server-fn-stream.ts";
import { producerFinalizer, readChunk, recordedScope } from "./stream-scope.fixture.ts";

const finalizerCount = 1;
const noFinalizers = 0;

const collectOpeningValues = Effect.fn("collectOpeningValues")(function* (
  reader: ReadableStreamDefaultReader<string>,
) {
  const first = yield* readChunk(reader);
  const second = yield* readChunk(reader);
  assert.deepEqual(
    [first, second],
    [
      { done: false, value: "one" },
      { done: false, value: "two" },
    ],
  );
  assert.deepEqual(yield* readChunk(reader), { done: true, value: undefined });
});

it.effect("preserves stream values and finishes its producer before request scope release", () =>
  Effect.gen(function* () {
    const events: string[] = [];
    const scope = yield* recordedScope(events);
    const source = Stream.make("one", "two").pipe(Stream.ensuring(producerFinalizer(events)));
    const readable = yield* serverFnStream(source).pipe(Scope.provide(scope));
    yield* collectOpeningValues(readable.getReader());
    expect(events).toStrictEqual(["producer finalized"]);
    yield* Scope.close(scope, Exit.void);
    expect(events).toStrictEqual(["producer finalized", "request released"]);
  }),
);

const states = ["unlocked", "locked", "canceling"] as const;
type ReaderState = (typeof states)[number];
type Reader = ReadableStreamDefaultReader<never>;

const producerInspection = Effect.fn("producerInspection")(function* (events: string[]) {
  const started = yield* Deferred.make<boolean>();
  const finalizing = yield* Deferred.make<boolean>();
  const finishFinalizer = yield* Deferred.make<boolean>();
  const source = Stream.fromEffect(
    Deferred.succeed(started, true).pipe(Effect.andThen(Effect.never)),
  ).pipe(
    Stream.ensuring(
      Effect.gen(function* () {
        events.push("producer finalizing");
        yield* Deferred.succeed(finalizing, true);
        yield* Deferred.await(finishFinalizer);
        events.push("producer finalized");
      }),
    ),
  );
  return { finalizing, finishFinalizer, source, started };
});

const beginCancellation = Effect.fn("beginCancellation")(function* (
  state: ReaderState,
  reader: Reader | undefined,
  finalizing: Deferred.Deferred<boolean>,
) {
  if (state !== "canceling" || Predicate.isNullish(reader)) {
    return Option.none<Fiber.Fiber<void>>();
  }
  const canceling = yield* Effect.forkChild(Effect.promise(async () => reader.cancel()));
  yield* Deferred.await(finalizing);
  return Option.some(canceling);
});

const awaitFinalization = Effect.fn("awaitFinalization")(function* (
  scope: Scope.Closeable,
  probe: Effect.Success<ReturnType<typeof producerInspection>>,
  events: string[],
) {
  const closing = yield* Effect.forkChild(Scope.close(scope, Exit.void));
  const first = yield* Effect.raceFirst(
    Deferred.await(probe.finalizing).pipe(Effect.as("producer finalizing")),
    Fiber.join(closing).pipe(Effect.as("request released")),
  );
  assert.strictEqual(first, "producer finalizing");
  assert.deepEqual(events, ["producer finalizing"]);
  yield* Deferred.succeed(probe.finishFinalizer, true);
  return closing;
});

const cancelReadable = (
  readable: ReadableStream<never>,
  reader: Reader | undefined,
): Effect.Effect<void> =>
  Effect.ignore(
    Effect.tryPromise(async () =>
      Predicate.isNullish(reader) ? readable.cancel() : reader.cancel(),
    ),
  );

const joinShutdown = Effect.fn("joinShutdown")(function* (
  closing: Fiber.Fiber<void>,
  canceling: Option.Option<Fiber.Fiber<void>>,
) {
  yield* Fiber.join(closing);
  if (Option.isSome(canceling)) {
    yield* Fiber.join(canceling.value);
  }
});

it.effect.each(states)(
  "waits for a %s reader's producer finalizer before releasing request services",
  (state) =>
    Effect.gen(function* () {
      const events: string[] = [];
      const probe = yield* producerInspection(events);
      const scope = yield* recordedScope(events);
      const readable = yield* serverFnStream(probe.source).pipe(Scope.provide(scope));
      const reader = state === "unlocked" ? undefined : readable.getReader();
      yield* Deferred.await(probe.started);
      const canceling = yield* beginCancellation(state, reader, probe.finalizing);
      const closing = yield* awaitFinalization(scope, probe, events);
      yield* cancelReadable(readable, reader).pipe(
        Effect.andThen(joinShutdown(closing, canceling)),
      );
      expect(events).toStrictEqual([
        "producer finalizing",
        "producer finalized",
        "request released",
      ]);
    }),
);

const observeTerminatedReader = Effect.fn("observeTerminatedReader")(function* (
  source: Stream.Stream<never>,
) {
  const count = yield* Ref.make(noFinalizers);
  const parent = yield* Effect.scope;
  const scope = yield* Scope.fork(parent);
  const tracked = source.pipe(
    Stream.ensuring(Ref.update(count, (previous) => previous + finalizerCount)),
  );
  const readable = yield* serverFnStream(tracked).pipe(Scope.provide(scope));
  const exit = yield* Effect.exit(readChunk(readable.getReader()));
  assert.strictEqual(yield* Ref.get(count), finalizerCount);
  yield* Scope.close(scope, Exit.void);
  assert.strictEqual(yield* Ref.get(count), finalizerCount);
  return exit;
});

it.effect.each(["empty", "defect"] as const)(
  "runs the %s producer finalizer exactly once",
  (outcome) =>
    Effect.gen(function* () {
      const defect = new DOMException("producer failed", "Error");
      const first = yield* observeTerminatedReader(
        outcome === "empty" ? Stream.empty : Stream.die(defect),
      );
      if (outcome === "empty") {
        expect(first).toStrictEqual(Exit.succeed({ done: true, value: undefined }));
      } else {
        assert(Exit.isFailure(first));
        expect(Cause.squash(first.cause)).toBe(defect);
      }
    }),
);
