import { describe, expect, it } from "@effect/vitest";
import { Deferred, Effect, Fiber, Stream } from "effect";
import { AsyncResult, AtomRegistry } from "effect/unstable/reactivity";
import { vi } from "vitest";

import { ServerFnDefect, ServerFnInputError, ServerFnTransportError } from "../rsc/server-fn-error";
import { query, stream, streamAtom } from "./query";
import { matchServerFnQuery } from "./server-fn-protocol";

describe("query", () => {
  it.effect("invokes the Server Function with positional args and an abort signal", () =>
    Effect.gen(function* () {
      const fetch = query((name: string) => {
        expect(name).toBe("Ada");
        return Promise.resolve(`Hello, ${name}`);
      });
      // Direct functions ignore the framework-only final marker.
      expect(yield* fetch("Ada")).toBe("Hello, Ada");
    }),
  );

  it.effect("matches a query marker without leaking it into encoded arguments", () =>
    Effect.gen(function* () {
      const observed = Promise.withResolvers<NonNullable<ReturnType<typeof matchServerFnQuery>>>();
      const serverFn = (...args: ReadonlyArray<unknown>) => {
        const matched = matchServerFnQuery(args);
        if (matched !== null) observed.resolve(matched);
        return Promise.resolve("done");
      };
      expect(yield* query(serverFn)("Ada")).toBe("done");
      const matched = yield* Effect.promise(() => observed.promise);
      expect(matched.args).toEqual(["Ada"]);
      expect(matched.signal).toBeInstanceOf(AbortSignal);
    }),
  );

  it.effect("retains framework input failure in the typed Effect error channel", () =>
    Effect.gen(function* () {
      const failure = new ServerFnInputError({
        detail: { message: "invalid", name: "ParseError" },
      });
      const result = yield* Effect.flip(query(() => Promise.reject(failure))());
      expect(result).toEqual(failure);
    }),
  );

  it.effect("translates a rejected transport promise to a typed transport error", () =>
    Effect.gen(function* () {
      const result = yield* Effect.flip(query(() => Promise.reject(new Error("offline")))());
      expect(result).toBeInstanceOf(ServerFnTransportError);
      expect(result.detail).toMatchObject({ message: "offline", name: "Error" });
    }),
  );

  it.effect("interrupts the callback signal when the query fiber is cancelled", () =>
    Effect.gen(function* () {
      const observed = Promise.withResolvers<AbortSignal>();
      const fetch = query((...args: ReadonlyArray<unknown>) => {
        const matched = matchServerFnQuery(args);
        if (matched !== null) observed.resolve(matched.signal);
        return new Promise<string>(() => undefined);
      });
      const fiber = yield* fetch().pipe(Effect.forkScoped({ startImmediately: true }));
      const signal = yield* Effect.promise(() => observed.promise);
      yield* Fiber.interrupt(fiber);
      expect(signal.aborted).toBe(true);
    }),
  );
});

describe("stream", () => {
  it("keeps streamAtom waiting after the last item and interrupts a superseded Flight", async () => {
    const calls: Array<NonNullable<ReturnType<typeof matchServerFnQuery>>> = [];
    const atom = streamAtom((...args: ReadonlyArray<unknown>) => {
      const matched = matchServerFnQuery(args);
      if (matched !== null) calls.push(matched);
      return Promise.resolve(
        new ReadableStream<string>({
          start(controller) {
            controller.enqueue(String(args[0]));
            controller.close();
          },
        }),
      );
    });
    const registry = AtomRegistry.make();
    try {
      registry.mount(atom);
      registry.set(atom, ["first"]);
      await vi.waitFor(() => expect(AsyncResult.getOrThrow(registry.get(atom))).toBe("first"));
      expect(registry.get(atom).waiting).toBe(true);
      expect(calls[0]?.signal.aborted).toBe(false);

      registry.set(atom, ["second"]);
      await vi.waitFor(() => expect(AsyncResult.getOrThrow(registry.get(atom))).toBe("second"));
      expect(calls[0]?.signal.aborted).toBe(true);
      expect(registry.get(atom).waiting).toBe(true);
      const second = calls[1];
      if (second?._tag !== "Stream") throw new TypeError("Expected stream metadata.");
      Deferred.doneUnsafe(second.completed, Effect.void);
      await vi.waitFor(() => expect(registry.get(atom).waiting).toBe(false));
      expect(AsyncResult.getOrThrow(registry.get(atom))).toBe("second");
    } finally {
      registry.dispose();
    }
  });

  it.effect("waits for full Flight completion after the returned stream closes", () =>
    Effect.gen(function* () {
      const observed = Promise.withResolvers<NonNullable<ReturnType<typeof matchServerFnQuery>>>();
      const read = stream((...args: ReadonlyArray<unknown>) => {
        const matched = matchServerFnQuery(args);
        if (matched !== null) observed.resolve(matched);
        return Promise.resolve(
          new ReadableStream<string>({
            start(controller) {
              controller.enqueue("card");
              controller.close();
            },
          }),
        );
      });
      const consumer = yield* Stream.runCollect(read()).pipe(Effect.forkScoped);
      const matched = yield* Effect.promise(() => observed.promise);
      expect(matched._tag).toBe("Stream");
      if (matched._tag !== "Stream") return yield* Effect.die("Expected stream metadata.");
      yield* Effect.yieldNow;
      expect(consumer.pollUnsafe()).toBeUndefined();
      expect(matched.signal.aborted).toBe(false);
      yield* Deferred.succeed(matched.completed, undefined);
      expect(yield* Fiber.join(consumer)).toEqual(["card"]);
      expect(matched.signal.aborted).toBe(true);
    }),
  );

  it.effect("propagates transport failure after the final stream value", () =>
    Effect.gen(function* () {
      const observed = Promise.withResolvers<NonNullable<ReturnType<typeof matchServerFnQuery>>>();
      const read = stream((...args: ReadonlyArray<unknown>) => {
        const matched = matchServerFnQuery(args);
        if (matched !== null) observed.resolve(matched);
        return Promise.resolve(
          new ReadableStream<string>({
            start(controller) {
              controller.enqueue("card");
              controller.close();
            },
          }),
        );
      });
      const consumer = yield* Stream.runCollect(read()).pipe(Effect.forkScoped);
      const matched = yield* Effect.promise(() => observed.promise);
      if (matched._tag !== "Stream") return yield* Effect.die("Expected stream metadata.");
      yield* Deferred.fail(
        matched.completed,
        new ServerFnTransportError({
          detail: { message: "connection lost", name: "Error", stack: null },
        }),
      );
      const failure = yield* Effect.flip(Fiber.join(consumer));
      expect(failure).toBeInstanceOf(ServerFnTransportError);
      expect(failure.detail?.message).toBe("connection lost");
    }),
  );

  it.effect("aborts its request when the consumer stops after one item", () =>
    Effect.gen(function* () {
      const observed = Promise.withResolvers<AbortSignal>();
      const read = stream((...args: ReadonlyArray<unknown>) => {
        const matched = matchServerFnQuery(args);
        if (matched !== null) observed.resolve(matched.signal);
        return Promise.resolve(
          new ReadableStream<string>({
            start(controller) {
              controller.enqueue("card");
            },
          }),
        );
      });
      yield* Stream.runDrain(read().pipe(Stream.take(1)));
      expect((yield* Effect.promise(() => observed.promise)).aborted).toBe(true);
    }),
  );

  it.effect("retains a Flight stream error digest", () =>
    Effect.gen(function* () {
      const read = stream((...args: ReadonlyArray<unknown>) => {
        const matched = matchServerFnQuery(args);
        if (matched?._tag === "Stream") {
          Deferred.doneUnsafe(matched.completed, Effect.void);
        }
        return Promise.resolve(
          new ReadableStream<string>({
            start(controller) {
              controller.error(
                Object.assign(new Error("producer failed"), { digest: "render-123" }),
              );
            },
          }),
        );
      });
      const failure = yield* Effect.flip(Stream.runDrain(read()));
      expect(failure).toBeInstanceOf(ServerFnDefect);
      expect(failure).toMatchObject({ digest: "render-123" });
    }),
  );
});
