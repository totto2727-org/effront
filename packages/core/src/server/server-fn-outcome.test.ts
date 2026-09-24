import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect } from "effect";

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

  it.effect("serializes input decode failures separately from handler failures", () =>
    Effect.gen(function* () {
      const result = yield* serverFnResponse(
        Effect.fail(new ServerFnInputError({ detail: { message: "Invalid count", name: "ParseError" } })),
      );
      expect(result).toEqual({
        _tag: "Failure",
        error: { _tag: "ServerFnInputError", detail: { message: "Invalid count", name: "ParseError" } },
      });
    }),
  );

  it.effect("gives unexpected handler failure a correlation digest rather than a raw error object", () =>
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
