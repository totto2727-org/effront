import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";

import { ServerFnInputError, ServerFnTransportError } from "#core/rsc/server-fn-error.ts";
import { proxy } from "./query-probe.fixture.ts";
import { query } from "./query.ts";
import type { MatchedQuery } from "./server-fn-protocol.ts";

describe("query invocation", () => {
  it.effect("invokes the Server Function with positional args and an abort signal", () =>
    Effect.gen(function* () {
      const greet = query(async (name: string) => {
        expect(name).toBe("Ada");
        await Promise.resolve();
        return `Hello, ${name}`;
      });
      // Direct functions ignore the framework-only final marker.
      expect(yield* greet("Ada")).toBe("Hello, Ada");
    }),
  );

  it.effect("matches a query marker without leaking it into encoded arguments", () =>
    Effect.gen(function* () {
      const observed = Promise.withResolvers<MatchedQuery>();
      const serverFn = proxy(observed.resolve, () => "done");
      expect(yield* query(serverFn)("Ada")).toBe("done");
      const matched = yield* Effect.promise(async () => observed.promise);
      expect(matched.args).toStrictEqual(["Ada"]);
      expect(matched.signal).toBeInstanceOf(AbortSignal);
    }),
  );
});

describe("query failure and cancellation", () => {
  it.effect("retains framework input failure in the typed Effect error channel", () =>
    Effect.gen(function* () {
      const failure = new ServerFnInputError({
        detail: { message: "invalid", name: "ParseError" },
      });
      const read = query(async () => {
        await Promise.resolve();
        throw failure;
      });
      const result = yield* Effect.flip(read());
      expect(result).toStrictEqual(failure);
    }),
  );

  it.effect("translates a rejected transport promise to a typed transport error", () =>
    Effect.gen(function* () {
      const offline = new DOMException("offline", "Error");
      const read = query(async () => {
        await Promise.resolve();
        throw offline;
      });
      const result = yield* Effect.flip(read());
      expect(result).toBeInstanceOf(ServerFnTransportError);
      expect(result.detail).toMatchObject({ message: "offline", name: "Error" });
    }),
  );

  it.effect("interrupts the callback signal when the query fiber is cancelled", () =>
    Effect.gen(function* () {
      const observed = Promise.withResolvers<MatchedQuery>();
      const interrupted = Promise.withResolvers<string>();
      const read = query(proxy(observed.resolve, async () => interrupted.promise));
      const fiber = yield* read().pipe(Effect.forkScoped({ startImmediately: true }));
      const { signal } = yield* Effect.promise(async () => observed.promise);
      yield* Fiber.interrupt(fiber);
      expect(signal.aborted).toBe(true);
    }),
  );
});
