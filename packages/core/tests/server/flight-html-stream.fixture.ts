// Adapted from the rsc-html-stream test suite by Devon Govett.
// Copyright (c) 2024-present Devon Govett. Licensed under the MIT License; see THIRD-PARTY-NOTICES.md.

// oxlint-disable-next-line rules/no-node-imports -- An isolated VM runs the exact scripts emitted for the browser Flight queue.
import { createContext, runInContext } from "node:vm";

import { Array, Effect, Predicate } from "effect";

import { makeInitialFlightStream } from "#core/client/initial-flight-stream.ts";
import type { EmbeddedFlightChunk } from "#core/client/initial-flight-stream.ts";
import { injectFlightPayload } from "#core/server/flight-html-stream.ts";
import type { FlightHtmlStreamOptions } from "#core/server/flight-html-stream.ts";

export const encoder = new TextEncoder();
export const decoder = new TextDecoder();

export type SourceChunk = string | Uint8Array | (() => void | Promise<void>);
type Source = Readonly<SourceChunk[]>;

export const streamFrom = (source: Source): ReadableStream<Uint8Array> =>
  new ReadableStream({
    async pull(controller) {
      // oxlint-disable-next-line rules/no-for-loops -- Run the native source callbacks in sequence and leave subsequent chunks gated.
      for (const chunk of source) {
        if (Predicate.isFunction(chunk)) {
          // oxlint-disable-next-line eslint/no-await-in-loop -- Each callback controls when the next byte reaches the browser.
          await chunk();
        } else {
          controller.enqueue(Predicate.isString(chunk) ? encoder.encode(chunk) : chunk);
        }
      }
      controller.close();
    },
  });

type Done = Effect.Success<typeof Effect.void>;

export const pause = async (milliseconds: number): Promise<Done> => {
  const gate = Promise.withResolvers<Done>();
  setTimeout(gate.resolve, milliseconds);
  await gate.promise;
};

const nextTurnDelay = 0;
export const nextTurn = (): Effect.Effect<void> => Effect.promise(async () => pause(nextTurnDelay));

export const bytesFrom = (
  stream: ReadableStream<Uint8Array>,
): Effect.Effect<Uint8Array<ArrayBuffer>> =>
  Effect.promise(async () => new Uint8Array(await new Response(stream).arrayBuffer()));

export const textFrom = (stream: ReadableStream<Uint8Array>): Effect.Effect<string> =>
  bytesFrom(stream).pipe(Effect.map((bytes) => decoder.decode(bytes)));

const flightQueue = (html: string, nonce?: string): EmbeddedFlightChunk[] => {
  const nonceAttribute = Predicate.isNullish(nonce) ? "" : ` nonce="${nonce}"`;
  const scripts = html.matchAll(new RegExp(`<script${nonceAttribute}>(.*?)<\\/script>`, "gu"));
  const self: { __FLIGHT_DATA?: EmbeddedFlightChunk[] } = {};
  const context = createContext({ Uint8Array, atob, self });
  const firstCapture = 1;
  Array.forEach(scripts, (script) => {
    runInContext(script.at(firstCapture) ?? "", context);
  });
  // oxlint-disable-next-line eslint/no-underscore-dangle -- Preserve the browser's public Flight buffer name.
  return self.__FLIGHT_DATA ?? [];
};

export const reconstructFlight = (
  html: string,
  nonce?: string,
): Effect.Effect<Uint8Array<ArrayBuffer>> => {
  const stream = makeInitialFlightStream(flightQueue(html, nonce), (close) => {
    close();
  });
  return bytesFrom(stream);
};

export const flightScript = (text: string): string =>
  `<script>(self.__FLIGHT_DATA||=[]).push(${JSON.stringify(text)})</script>`;

type HtmlStream = ReadableStream<Uint8Array>;
export const withFlight = (
  html: HtmlStream,
  flight: HtmlStream,
  options?: FlightHtmlStreamOptions,
): HtmlStream => html.pipeThrough(injectFlightPayload(flight, options));
