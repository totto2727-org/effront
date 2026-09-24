import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit, Scope, Stream } from "effect";

import { ServerFnInputError } from "../rsc/server-fn-error";
import { serverFnOutcome, serverFnResponse } from "./server-fn-outcome";

describe("serverFnResponse", () => {
  it.effect("preserves interruption instead of serializing a failure", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(serverFnResponse(Effect.interrupt));
      expect(exit._tag).toBe("Failure");
      if (exit._tag === "Failure") {
        expect(Cause.hasInterrupts(exit.cause)).toBe(true);
      }
    }),
  );

  it.effect("returns successful results without changing mutation response status", () =>
    Effect.gen(function* () {
      expect(yield* serverFnOutcome(Effect.succeed("saved"))).toEqual({
        serverFnResult: { _tag: "Success", value: "saved" },
        status: 200,
      });
    }),
  );

  it.effect("returns a top-level Stream as a live Flight ReadableStream", () =>
    Effect.gen(function* () {
      const events: Array<string> = [];
      const scope = yield* Scope.fork(yield* Effect.scope);
      yield* Effect.addFinalizer(() => Effect.sync(() => events.push("request released"))).pipe(
        Scope.provide(scope),
      );
      const source = Stream.make("first", "second").pipe(
        Stream.ensuring(Effect.sync(() => events.push("producer finalized"))),
      );
      const result = yield* serverFnResponse(Effect.succeed(source)).pipe(Scope.provide(scope));
      expect(result._tag).toBe("Success");
      if (result._tag !== "Success" || !(result.value instanceof ReadableStream)) {
        return yield* Effect.die("Expected a streaming Flight value.");
      }
      const reader = result.value.getReader();
      expect((yield* Effect.promise(() => reader.read())).value).toBe("first");
      expect((yield* Effect.promise(() => reader.read())).value).toBe("second");
      expect((yield* Effect.promise(() => reader.read())).done).toBe(true);
      expect(events).toEqual(["producer finalized"]);
      yield* Scope.close(scope, Exit.void);
      expect(events).toEqual(["producer finalized", "request released"]);
    }),
  );

  it.effect("serializes input decode failures separately from handler failures", () =>
    Effect.gen(function* () {
      const result = yield* serverFnResponse(
        Effect.fail(
          new ServerFnInputError({ detail: { message: "Invalid count", name: "ParseError" } }),
        ),
      );
      expect(result).toEqual({
        _tag: "Failure",
        error: {
          _tag: "ServerFnInputError",
          detail: { message: "Invalid count", name: "ParseError" },
        },
      });
    }),
  );

  it.effect(
    "gives unexpected handler failure a correlation digest rather than a raw error object",
    () =>
      Effect.gen(function* () {
        const result = yield* serverFnResponse(Effect.fail(new Error("private detail")));
        expect(result).toMatchObject({
          _tag: "Failure",
          error: { _tag: "ServerFnDefect", digest: expect.any(String) },
        });
        if (result._tag === "Failure" && result.error._tag === "ServerFnDefect") {
          expect(result.error.digest.length).toBeGreaterThan(0);
        }
      }),
  );
});
