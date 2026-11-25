// Adapted from the rsc-html-stream test suite by Devon Govett.
// Copyright (c) 2024-present Devon Govett. Licensed under the MIT License; see THIRD-PARTY-NOTICES.md.

import { describe, expect, it } from "@effect/vitest";
import { Array, Effect } from "effect";

import {
  decoder,
  encoder,
  flightScript,
  reconstructFlight,
  streamFrom,
  textFrom,
  withFlight,
} from "./flight-html-stream.fixture.ts";

const testDocument = "<html><body>Test</body></html>";

describe("flight bytes embedded in html", () => {
  it.effect("embeds text chunks and reconstructs the original flight bytes", () =>
    Effect.gen(function* () {
      const chunks = ["foo bar", "baz qux", "abcdef"];
      const scripts = chunks.map((text) => flightScript(text)).join("");
      const html = streamFrom(["<html><body><h1>Test</h1>", "<p>Hello world</p></body></html>"]);

      const result = yield* textFrom(withFlight(html, streamFrom(chunks)));
      const reconstructed = yield* reconstructFlight(result);
      expect(result).toBe(`<html><body><h1>Test</h1><p>Hello world</p>${scripts}</body></html>`);
      expect(decoder.decode(reconstructed)).toBe(chunks.join(""));
    }),
  );

  it.effect("uses base64 for invalid utf-8 and reconstructs the original bytes", () =>
    Effect.gen(function* () {
      const binary = Uint8Array.of(1, 2, 3, 4, 5, 226, 40, 161);
      const html = streamFrom(["<html><body><h1>Test</h1></body></html>"]);
      const flight = streamFrom(["foo bar", binary]);

      const result = yield* textFrom(withFlight(html, flight));
      expect(result).toContain(
        "<script>(self.__FLIGHT_DATA||=[]).push(" +
          'Uint8Array.from(atob("AQIDBAXiKKE="),character=>character.codePointAt(0)))</script>',
      );
      const reconstructed = yield* reconstructFlight(result);
      expect(reconstructed).toStrictEqual(
        new Uint8Array([...encoder.encode("foo bar"), ...binary]),
      );
    }),
  );
});

describe("flight script markup", () => {
  it.effect("adds the supplied nonce to the embedded script", () =>
    Effect.gen(function* () {
      const html = streamFrom([testDocument]);
      const flight = streamFrom(["foo bar"]);
      const result = yield* textFrom(withFlight(html, flight, { nonce: "test" }));

      expect(result).toBe(
        '<html><body>Test<script nonce="test">' +
          '(self.__FLIGHT_DATA||=[]).push("foo bar")</script></body></html>',
      );
      const reconstructed = yield* reconstructFlight(result, "test");
      expect(decoder.decode(reconstructed)).toBe("foo bar");
    }),
  );

  it.effect("escapes script endings and html comments in text chunks", () =>
    Effect.gen(function* () {
      const result = yield* textFrom(
        withFlight(streamFrom([testDocument]), streamFrom(["<!--</ScRiPt>"])),
      );
      expect(result).toContain(String.raw`<\!--</\ScRiPt>`);
      const reconstructed = yield* reconstructFlight(result);
      expect(decoder.decode(reconstructed)).toBe("<!--</ScRiPt>");
    }),
  );
});

const withChunks = (chunks: Uint8Array[]): Effect.Effect<string> =>
  textFrom(withFlight(streamFrom([testDocument]), streamFrom(chunks)));

describe("flight utf-8 and binary chunk boundaries", () => {
  it.effect("reconstructs arbitrary flight bytes at every possible chunk split", () =>
    Effect.gen(function* () {
      const firstSplit = 0;
      const maxByte = 255;
      const incompleteUtf8 = 226;
      const bytes = new Uint8Array([
        ...encoder.encode("ASCII 日本語🙂\uFEFF"),
        ...Array.range(firstSplit, maxByte),
        ...encoder.encode("after binary \uFEFF"),
        incompleteUtf8,
      ]);
      yield* Effect.forEach(
        Array.range(firstSplit, bytes.byteLength),
        (split) =>
          Effect.gen(function* () {
            const chunks = [bytes.slice(firstSplit, split), bytes.slice(split)];
            const result = yield* withChunks(chunks);
            const reconstructed = yield* reconstructFlight(result);
            expect(reconstructed, `Flight byte split ${split}`).toStrictEqual(bytes);
          }),
        { discard: true },
      );
    }),
  );

  it.effect("preserves pending utf-8 before invalid bytes and incomplete terminal chunks", () =>
    Effect.gen(function* () {
      const chunks = [
        Uint8Array.of(97, 226),
        Uint8Array.of(40, 161),
        encoder.encode("\uFEFF日本語"),
        Uint8Array.of(240, 159),
      ];
      const result = yield* withChunks(chunks);
      const reconstructed = yield* reconstructFlight(result);
      expect(reconstructed).toStrictEqual(
        new Uint8Array(Array.flatMap(chunks, (chunk) => [...chunk])),
      );
    }),
  );
});
