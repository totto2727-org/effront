// Adapted from the rsc-html-stream test suite by Devon Govett.
// Copyright (c) 2024-present Devon Govett. Licensed under the MIT License; see THIRD-PARTY-NOTICES.md.
import { describe, expect, it } from "@effect/vitest";
import { Deferred, Effect } from "effect";

import { makeInitialFlightStream } from "./initial-flight-stream.ts";
import type { EmbeddedFlightChunk } from "./initial-flight-stream.ts";

const encoder = new TextEncoder();
const binary = new Uint8Array([0, 255]);

describe("initial Flight stream", () => {
  it.effect(
    "drains embedded chunks, accepts later scripts, and closes when the document is ready",
    () =>
      Effect.gen(function* () {
        const queue: EmbeddedFlightChunk[] = ["initial", binary];
        const ready = yield* Deferred.make<() => void>();
        const reader = makeInitialFlightStream(queue, (close) => {
          Deferred.doneUnsafe(ready, Effect.succeed(close));
        }).getReader();
        const read = Effect.promise(async () => reader.read());

        expect(yield* Effect.all([read, read])).toStrictEqual([
          { done: false, value: encoder.encode("initial") },
          { done: false, value: binary },
        ]);
        expect([queue.length, queue.push("later")]).toStrictEqual([0, 0]);
        expect(yield* read).toStrictEqual({ done: false, value: encoder.encode("later") });

        yield* Deferred.await(ready).pipe(Effect.flatMap(Effect.sync));
        expect(yield* read).toStrictEqual({ done: true, value: undefined });
      }),
  );
});
