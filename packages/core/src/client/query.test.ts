import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";

import { ServerFnInputError, ServerFnTransportError } from "../rsc/server-fn-error";
import { query } from "./query";
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
      const failure = new ServerFnInputError({ detail: { message: "invalid", name: "ParseError" } });
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
