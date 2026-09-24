import { it, expect } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber, Scope, Stream } from "effect";

import { serverFnStream } from "./server-fn-stream";

it.effect("preserves stream values and finishes its producer before request scope release", () =>
  Effect.gen(function* () {
    const events: Array<string> = [];
    const scope = yield* Scope.fork(yield* Effect.scope);
    yield* Effect.addFinalizer(() => Effect.sync(() => events.push("request released"))).pipe(
      Scope.provide(scope),
    );
    const source = Stream.make("one", "two").pipe(
      Stream.ensuring(Effect.sync(() => events.push("producer finalized"))),
    );
    const readable = yield* serverFnStream(source).pipe(Scope.provide(scope));
    const reader = readable.getReader();
    const values = [
      yield* Effect.promise(() => reader.read()),
      yield* Effect.promise(() => reader.read()),
    ];
    expect(values).toEqual([
      { done: false, value: "one" },
      { done: false, value: "two" },
    ]);
    expect(yield* Effect.promise(() => reader.read())).toEqual({ done: true, value: undefined });
    expect(events).toEqual(["producer finalized"]);
    yield* Scope.close(scope, Exit.void);
    expect(events).toEqual(["producer finalized", "request released"]);
  }),
);

it.effect.each(["unlocked", "locked", "canceling"] as const)(
  "waits for a %s reader's producer finalizer before releasing request services",
  (readerState) =>
    Effect.gen(function* () {
      const events: Array<string> = [];
      const started = yield* Deferred.make<void>();
      const finalizing = yield* Deferred.make<void>();
      const finishFinalizer = yield* Deferred.make<void>();
      const scope = yield* Scope.fork(yield* Effect.scope);
      yield* Effect.addFinalizer(() => Effect.sync(() => events.push("request released"))).pipe(
        Scope.provide(scope),
      );
      const source = Stream.fromEffect(
        Deferred.succeed(started, undefined).pipe(Effect.andThen(Effect.never)),
      ).pipe(
        Stream.ensuring(
          Effect.gen(function* () {
            events.push("producer finalizing");
            yield* Deferred.succeed(finalizing, undefined);
            yield* Deferred.await(finishFinalizer);
            events.push("producer finalized");
          }),
        ),
      );
      const readable = yield* serverFnStream(source).pipe(Scope.provide(scope));
      const reader = readerState === "unlocked" ? null : readable.getReader();
      yield* Deferred.await(started);
      const canceling =
        readerState === "canceling" && reader !== null
          ? yield* Effect.forkChild(Effect.promise(() => reader.cancel()))
          : null;
      if (canceling !== null) {
        yield* Deferred.await(finalizing);
      }
      const closing = yield* Effect.forkChild(Scope.close(scope, Exit.void));
      const first = yield* Effect.raceFirst(
        Deferred.await(finalizing).pipe(Effect.as("producer finalizing")),
        Fiber.join(closing).pipe(Effect.as("request released")),
      );
      expect(first).toBe("producer finalizing");
      expect(events).toEqual(["producer finalizing"]);
      yield* Deferred.succeed(finishFinalizer, undefined);
      yield* Effect.promise(() =>
        (reader === null ? readable.cancel() : reader.cancel()).catch(() => undefined),
      );
      yield* Fiber.join(closing);
      if (canceling !== null) {
        yield* Fiber.join(canceling);
      }
      expect(events).toEqual(["producer finalizing", "producer finalized", "request released"]);
    }),
);

it.effect.each(["empty", "defect"] as const)(
  "runs the %s producer finalizer exactly once",
  (outcome) =>
    Effect.gen(function* () {
      let finalizations = 0;
      const defect = new Error("producer failed");
      const scope = yield* Scope.fork(yield* Effect.scope);
      const source = (outcome === "empty" ? Stream.empty : Stream.die(defect)).pipe(
        Stream.ensuring(Effect.sync(() => finalizations++)),
      );
      const readable = yield* serverFnStream(source).pipe(Scope.provide(scope));
      const first = yield* Effect.exit(Effect.promise(() => readable.getReader().read()));
      expect(finalizations).toBe(1);
      yield* Scope.close(scope, Exit.void);
      expect(finalizations).toBe(1);
      if (outcome === "empty") {
        expect(first).toEqual(Exit.succeed({ done: true, value: undefined }));
      } else if (Exit.isFailure(first)) {
        expect(Cause.squash(first.cause)).toBe(defect);
      } else {
        expect.unreachable("Expected the producer defect.");
      }
    }),
);
