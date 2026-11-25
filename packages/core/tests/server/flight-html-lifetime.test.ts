// Adapted from the rsc-html-stream test suite by Devon Govett.
// Copyright (c) 2024-present Devon Govett. Licensed under the MIT License; see THIRD-PARTY-NOTICES.md.

import { describe, expect, it } from "@effect/vitest";
import { Effect, MutableRef } from "effect";

import {
  decoder,
  encoder,
  flightScript,
  nextTurn,
  pause,
  reconstructFlight,
  streamFrom,
  textFrom,
  withFlight,
} from "./flight-html-stream.fixture.ts";

type Done = Effect.Success<typeof Effect.void>;
type Reader = ReadableStreamDefaultReader<Uint8Array>;
type Chunk = Awaited<ReturnType<Reader["read"]>>;

const read = (reader: Reader): Effect.Effect<Chunk> => Effect.promise(async () => reader.read());

type StagedDocument = Readonly<{
  content: string;
  flight: ReadableStream<Uint8Array>;
  flightRead: PromiseWithResolvers<Done>;
  flightReady: PromiseWithResolvers<Done>;
  htmlReady: PromiseWithResolvers<Done>;
  reader: Reader;
  shell: string;
}>;

const stagedDocument = (): StagedDocument => {
  const htmlReady = Promise.withResolvers<Done>();
  const flightReady = Promise.withResolvers<Done>();
  const flightRead = Promise.withResolvers<Done>();
  const shell = "<html><body><p>streamed shell</p>";
  const content = "<p>resolved content</p>";
  const html = streamFrom([shell, async () => htmlReady.promise, `${content}</body></html>`]);
  const flight = streamFrom([async () => flightReady.promise, "late Flight", flightRead.resolve]);
  const reader = withFlight(html, flight).getReader();
  return { content, flight, flightRead, flightReady, htmlReady, reader, shell };
};

const waitForPayload = Effect.fn("effront.test.observeLateFlightPayload")(function* ({
  flightRead,
  flightReady,
  reader,
}: StagedDocument) {
  const settled = MutableRef.make(false);
  const monitor = async (): Promise<Chunk> => {
    const item = await reader.read();
    MutableRef.set(settled, true);
    return item;
  };
  const payload = monitor();
  yield* nextTurn();
  const completedBeforeFlight = MutableRef.get(settled);
  flightReady.resolve();
  const result = yield* Effect.promise(async () => payload);
  yield* Effect.promise(async () => flightRead.promise);
  return { completedBeforeFlight, value: result.value };
});

describe("native shell output before flight eof", () => {
  it.effect("streams shell and later html before the final flight chunk and trailer", () =>
    Effect.gen(function* () {
      const document = stagedDocument();
      const { content, flight, htmlReady, reader, shell } = document;
      expect((yield* read(reader)).value).toStrictEqual(encoder.encode(shell));
      htmlReady.resolve();
      const later = yield* read(reader);
      expect(later.value).toStrictEqual(encoder.encode(content));

      const payload = yield* waitForPayload(document);
      const trailer = yield* read(reader);
      const eof = yield* read(reader);
      expect({
        eof: eof.done,
        locked: flight.locked,
        payload,
        trailer: trailer.value,
      }).toStrictEqual({
        eof: true,
        locked: false,
        payload: {
          completedBeforeFlight: false,
          value: encoder.encode(flightScript("late Flight")),
        },
        trailer: encoder.encode("</body></html>"),
      });
    }),
  );
});

const ssrHtml = (flight: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> => {
  const reader = flight.getReader();
  return new ReadableStream({
    async pull(controller) {
      const result = await reader.read();
      if (result.done) {
        reader.releaseLock();
        controller.enqueue(encoder.encode("</body></html>"));
        controller.close();
      } else {
        controller.enqueue(encoder.encode(`<p>${decoder.decode(result.value)}</p>`));
      }
    },
    start(controller) {
      controller.enqueue(encoder.encode("<html><body>"));
    },
  });
};

describe("ssr and browser consumption of the same flight stream", () => {
  it.effect("lets the ssr tee branch finish while browser injection waits for html eof", () =>
    Effect.gen(function* () {
      const delay = 0;
      const waitForNext = async (): Promise<Done> => pause(delay);
      const chunks = ["first", "second", "third"];
      const [ssr, browser] = streamFrom([
        "first",
        waitForNext,
        "second",
        waitForNext,
        "third",
      ]).tee();
      const output = yield* textFrom(withFlight(ssrHtml(ssr), browser));
      const pages = chunks.map((text) => `<p>${text}</p>`).join("");
      const scripts = chunks.map((text) => flightScript(text)).join("");
      const reconstructed = yield* reconstructFlight(output);
      expect(output).toBe(`<html><body>${pages}${scripts}</body></html>`);
      expect(reconstructed).toStrictEqual(encoder.encode(chunks.join("")));
    }),
  );

  it.effect("propagates a flight read failure after streamed html and releases its reader", () =>
    Effect.gen(function* () {
      const failure = new DOMException("Flight read failed", "NetworkError");
      const flight = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.error(failure);
        },
      });
      const html = streamFrom(["<html><body>shell</body></html>"]);
      const reader = withFlight(html, flight).getReader();
      const shell = yield* read(reader);
      expect(shell.value).toStrictEqual(encoder.encode("<html><body>shell"));
      yield* Effect.promise(async () => expect(reader.read()).rejects.toBe(failure));
      expect(flight.locked).toBe(false);
    }),
  );
});
