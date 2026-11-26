// Adapted from the rsc-html-stream test suite by Devon Govett.
// Copyright (c) 2024-present Devon Govett. Licensed under the MIT License; see THIRD-PARTY-NOTICES.md.

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import {
  bytesFrom,
  encoder,
  flightScript,
  pause,
  streamFrom,
  textFrom,
  withFlight,
} from "./flight-html-stream.fixture.ts";
import type { SourceChunk } from "./flight-html-stream.fixture.ts";

type Done = Effect.Success<typeof Effect.void>;
const nextTurn = 0;
const delayedChunk = 3;
const waitForNextTurn = async (): Promise<Done> => pause(nextTurn);

describe("flight emission after the html body", () => {
  it.effect("forwards all html before scheduled flight scripts", () =>
    Effect.gen(function* () {
      const gate = Promise.withResolvers<Done>();
      const html = streamFrom([
        "<html><body><h1>Test</h1>",
        async () => pause(delayedChunk),
        "<p>Hello",
        gate.resolve,
        " world</p></body></html>",
      ]);
      const chunks = ["foo bar", "baz qux", "abcdef"];
      const flight = streamFrom(["foo bar", async () => gate.promise, "baz qux", "abcdef"]);
      const result = yield* textFrom(withFlight(html, flight));
      const scripts = chunks.map((chunk) => flightScript(chunk)).join("");
      const positions = chunks.map((chunk) => result.indexOf(`push(${JSON.stringify(chunk)})`));
      expect(result).toBe(`<html><body><h1>Test</h1><p>Hello world</p>${scripts}</body></html>`);
      expect(positions).toStrictEqual(positions.toSorted((left, right) => left - right));
    }),
  );

  it.effect("retains a multi-byte html character and the split closing trailer", () =>
    Effect.gen(function* () {
      const html = streamFrom([
        "<html><body><h1>Test</h1>",
        Uint8Array.of(240),
        Uint8Array.of(159),
        waitForNextTurn,
        Uint8Array.of(153, 130),
        "<p>Hello world</p></bo",
        "dy></html>",
      ]);
      const result = yield* textFrom(withFlight(html, streamFrom(["foo bar"])));
      expect(result).toBe(
        `<html><body><h1>Test</h1>🙂<p>Hello world</p>${flightScript("foo bar")}</body></html>`,
      );
    }),
  );
});

const splitTokens = [
  { name: "double-quoted href", prefix: '<a href="/guide/', suffix: '日本語">日本語</a>' },
  { name: "single-quoted attribute", prefix: "<a title='日本", suffix: "語'>link</a>" },
  { name: "unquoted attribute", prefix: "<a href=/gui", suffix: "de>link</a>" },
  { name: "tag name", prefix: "<arti", suffix: "cle>日本語</article>" },
  { name: "comment", prefix: "<!-- sidebar ", suffix: "navigation --><p>日本語</p>" },
  {
    name: "script rawtext",
    prefix: '<script>self.example = "',
    suffix: '</body></html>";</script><p>日本語</p>',
  },
  {
    name: "style rawtext",
    prefix: '<style>.sidebar::after { content: "',
    suffix: '日本語"; }</style><p>日本語</p>',
  },
  { name: "textarea rawtext", prefix: "<textarea>日本", suffix: "語</textarea>" },
  { name: "character reference", prefix: "<p>&am", suffix: "p;日本語</p>" },
];

const htmlTokenChunks = (prefix: string, suffix: string, resume: () => void): SourceChunk[] => [
  `<html><body>${prefix}`,
  async () => {
    resume();
    await pause(nextTurn);
  },
  `${suffix}</bo`,
  waitForNextTurn,
  "dy></html>",
];

describe("flight markers between native html tokens", () => {
  it.effect.each(splitTokens)(
    "keeps scheduled flight outside a split $name",
    ({ prefix, suffix }) =>
      Effect.gen(function* () {
        const gate = Promise.withResolvers<Done>();
        const html = streamFrom(htmlTokenChunks(prefix, suffix, gate.resolve));
        const flight = streamFrom([
          async () => gate.promise,
          "scheduled Flight",
          waitForNextTurn,
          "later Flight",
        ]);
        const result = yield* textFrom(withFlight(html, flight));
        const scheduled = flightScript("scheduled Flight");
        const later = flightScript("later Flight");

        // Compare all bytes so a Flight script hidden inside a token still fails the test.
        expect(result).toBe(`<html><body>${prefix}${suffix}${scheduled}${later}</body></html>`);
      }),
  );
});

describe("flight scheduling between individual html bytes", () => {
  it.effect("preserves every scheduled multibyte html chunk", () =>
    Effect.gen(function* () {
      const body = '<html><body><a href="/日本語">日本語🙂</a>';
      const document = encoder.encode(`${body}</body></html>`);
      const chunks = [...document].flatMap((byte): SourceChunk[] => [
        Uint8Array.of(byte),
        waitForNextTurn,
      ]);
      const flight = streamFrom([async () => pause(delayedChunk), "scheduled Flight"]);
      const result = yield* bytesFrom(withFlight(streamFrom(chunks), flight));

      expect(result).toStrictEqual(
        encoder.encode(`${body}${flightScript("scheduled Flight")}</body></html>`),
      );
    }),
  );
});
