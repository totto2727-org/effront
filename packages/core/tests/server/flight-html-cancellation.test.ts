// Adapted from the rsc-html-stream test suite by Devon Govett.
// Copyright (c) 2024-present Devon Govett. Licensed under the MIT License; see THIRD-PARTY-NOTICES.md.

import { describe, expect, it } from "@effect/vitest";
import { Effect, Predicate } from "effect";

import { encoder, nextTurn, streamFrom, withFlight } from "./flight-html-stream.fixture.ts";

const shellDocument = "<html><body>shell</body></html>";
const responseCancelled = "response cancelled";
const requestFinalized = "request scope released";

const pendingBrowserFlight = Effect.fnUntraced(function* (flight: ReadableStream<Uint8Array>) {
  const reader = withFlight(streamFrom([shellDocument]), flight).getReader();
  yield* Effect.promise(async () => reader.read());
  const pending = reader.read();
  yield* nextTurn();
  return { pending, reader };
});

const trackSourceCancellation = (
  cancelled: unknown[],
  source?: string,
): ReadableStream<Uint8Array> =>
  new ReadableStream({
    cancel(reason) {
      const observed: unknown = reason;
      cancelled.push(Predicate.isString(source) ? [source, observed] : observed);
    },
  });

const completeSsrCancellation = Effect.fnUntraced(function* (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  pending: ReturnType<ReadableStreamDefaultReader<Uint8Array>["read"]>,
) {
  // The caller can release the server response scope only after browser cancellation settles.
  yield* Effect.promise(async () => reader.cancel(requestFinalized));
  const result = yield* Effect.promise(async () => pending);
  if (!result.done) {
    yield* Effect.die("Expected EOF after SSR reader cancellation.");
  }
  reader.releaseLock();
});

describe("cancellation of a browser response blocked on flight", () => {
  it.effect("settles an overlapping read and cancellation", () =>
    Effect.gen(function* () {
      const html = streamFrom(["<html><body><h1>html</h1></body></html>"]);
      const flight = streamFrom(["rsc"]);
      const reader = withFlight(html, flight).getReader();

      const pending = reader.read();
      yield* nextTurn();
      const cancel = reader.cancel();
      const [read, closed] = yield* Effect.promise(async () =>
        Promise.allSettled([pending, cancel]),
      );
      expect([read.status, closed.status]).toStrictEqual(["fulfilled", "fulfilled"]);
    }),
  );

  it.effect("cancels pending flight after html eof before waiting for transform flush", () =>
    Effect.gen(function* () {
      const cancelled: unknown[] = [];
      const flight = trackSourceCancellation(cancelled);
      const { pending, reader } = yield* pendingBrowserFlight(flight);
      yield* Effect.promise(async () => reader.cancel(responseCancelled));
      const result = yield* Effect.promise(async () => pending);
      expect({ cancelled, done: result.done, locked: flight.locked }).toStrictEqual({
        cancelled: [responseCancelled],
        done: true,
        locked: false,
      });
    }),
  );
});

describe("cancellation with a live ssr tee sibling", () => {
  it.effect("allows request release before the native ssr tee sibling settles", () =>
    Effect.gen(function* () {
      const cancelled: unknown[] = [];
      const [ssr, browser] = trackSourceCancellation(cancelled).tee();
      const ssrReader = ssr.getReader();
      const ssrPending = ssrReader.read();
      const { pending, reader } = yield* pendingBrowserFlight(browser);
      yield* Effect.promise(async () => reader.cancel(responseCancelled));
      const browserResult = yield* Effect.promise(async () => pending);
      expect({ cancelled, done: browserResult.done, locked: browser.locked }).toStrictEqual({
        cancelled: [],
        done: true,
        locked: false,
      });
      yield* completeSsrCancellation(ssrReader, ssrPending);
      expect(cancelled).toStrictEqual([[requestFinalized, responseCancelled]]);
    }),
  );
});

describe("browser response cancellation and html failure before eof", () => {
  it.effect("cancels both sources in order when the response is cancelled before html eof", () =>
    Effect.gen(function* () {
      const cancelled: unknown[] = [];
      const html = new ReadableStream<Uint8Array>({
        cancel(reason) {
          const observed: unknown = reason;
          cancelled.push(["html", observed]);
        },
        start(controller) {
          controller.enqueue(encoder.encode("<html><body>shell"));
        },
      });
      const flight = trackSourceCancellation(cancelled, "flight");
      const reader = withFlight(html, flight).getReader();
      yield* Effect.promise(async () => reader.read());
      yield* Effect.promise(async () => reader.cancel(responseCancelled));
      yield* nextTurn();
      expect(cancelled).toStrictEqual([
        ["flight", responseCancelled],
        ["html", responseCancelled],
      ]);
      expect(flight.locked).toBe(false);
    }),
  );

  it.effect("cancels unread flight when html errors before eof", () =>
    Effect.gen(function* () {
      const failure = new DOMException("HTML rendering failed", "OperationError");
      const cancelled: unknown[] = [];
      const flight = trackSourceCancellation(cancelled);
      const html = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.error(failure);
        },
      });
      const reader = withFlight(html, flight).getReader();
      yield* Effect.promise(async () => expect(reader.read()).rejects.toBe(failure));
      expect(cancelled).toStrictEqual([failure]);
      expect(flight.locked).toBe(false);
    }),
  );
});
