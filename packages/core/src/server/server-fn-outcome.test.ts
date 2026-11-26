import { assert, describe, expect, it } from "@effect/vitest";
import { Cause, Data, Effect, Exit, Predicate, Scope, Stream } from "effect";

import type { ServerFnResult } from "#core/rsc/flight.ts";
import type { ServerFnFailureModel } from "#core/rsc/server-fn-error.ts";
import { ServerFnInputError } from "#core/rsc/server-fn-error.ts";
import { serverFnOutcome, serverFnResponse } from "./server-fn-outcome.ts";
import { producerFinalizer, readChunk, recordedScope } from "./stream-scope.fixture.ts";

const results = Data.taggedEnum<ServerFnResult>();
const { ServerFnInputError: inputFailure } = Data.taggedEnum<ServerFnFailureModel>();
const ok = 200;
const noDigest = 0;

describe("server function outcomes", () => {
  it.effect("preserves interruption instead of serializing a failure", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(serverFnResponse(Effect.interrupt));
      assert(Exit.isFailure(exit));
      expect(Cause.hasInterrupts(exit.cause)).toBe(true);
    }),
  );

  it.effect("returns successful results without changing mutation response status", () =>
    Effect.gen(function* () {
      expect(yield* serverFnOutcome(Effect.succeed("saved"))).toStrictEqual({
        serverFnResult: results.Success({ value: "saved" }),
        status: ok,
      });
    }),
  );

  it.effect("serializes input decode failures separately from handler failures", () =>
    Effect.gen(function* () {
      const detail = { message: "Invalid count", name: "ParseError" };
      const result = yield* serverFnResponse(Effect.fail(new ServerFnInputError({ detail })));
      expect(result).toStrictEqual(results.Failure({ error: inputFailure({ detail }) }));
    }),
  );

  it.effect(
    "gives unexpected handler failure a correlation digest rather than a raw error object",
    () =>
      Effect.gen(function* () {
        const defect = new DOMException("private detail", "Error");
        const result = yield* serverFnResponse(Effect.fail(defect));
        assert(results.$is("Failure")(result));
        assert(Predicate.isTagged(result.error, "ServerFnDefect"));
        expect(result.error.digest.length).toBeGreaterThan(noDigest);
      }),
  );
});

const expectPublishedChunks = Effect.fnUntraced(function* (result: ServerFnResult) {
  assert(results.$is("Success")(result));
  assert(result.value instanceof ReadableStream);
  const reader = result.value.getReader();
  const first = yield* readChunk(reader);
  const second = yield* readChunk(reader);
  const terminal = yield* readChunk(reader);
  assert.deepEqual([first.value, second.value, terminal.done], ["first", "second", true]);
});

it.effect("returns a top-level Stream as a live Flight ReadableStream", () =>
  Effect.gen(function* () {
    const events: string[] = [];
    const scope = yield* recordedScope(events);
    const source = Stream.make("first", "second").pipe(Stream.ensuring(producerFinalizer(events)));
    const result = yield* serverFnResponse(Effect.succeed(source)).pipe(Scope.provide(scope));
    yield* expectPublishedChunks(result);

    expect(events).toStrictEqual(["producer finalized"]);
    yield* Scope.close(scope, Exit.void);
    expect(events).toStrictEqual(["producer finalized", "request released"]);
  }),
);
