// Adapted from rsc-html-stream by Devon Govett.
// Copyright (c) 2024-present Devon Govett. Licensed under the MIT License; see THIRD-PARTY-NOTICES.md.
import { Context, Effect, Iterable, Layer, Predicate } from "effect";

const encoder = new TextEncoder();
const emptyQueueLength = 0;
const embeddedQueue = "__FLIGHT_DATA";

export type EmbeddedFlightChunk = string | Uint8Array;
type EmbeddedFlightQueue = EmbeddedFlightChunk[];
type FlightWindow = Window & { [embeddedQueue]?: EmbeddedFlightQueue };

export const makeInitialFlightStream = (
  queue: EmbeddedFlightQueue,
  closeWhenReady: (close: () => void) => void,
): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      const enqueue = (chunk: EmbeddedFlightChunk): void => {
        controller.enqueue(Predicate.isString(chunk) ? encoder.encode(chunk) : chunk);
      };
      Iterable.forEach(queue, enqueue);
      queue.length = emptyQueueLength;
      queue.push = (...chunks) => {
        Iterable.forEach(chunks, enqueue);
        return emptyQueueLength;
      };
      closeWhenReady(() => {
        controller.close();
      });
    },
  });

const makeBrowserInitialFlightStream = (flightWindow: FlightWindow): ReadableStream<Uint8Array> => {
  flightWindow[embeddedQueue] ??= [];
  const queue = flightWindow[embeddedQueue];
  return makeInitialFlightStream(queue, (close) => {
    if (globalThis.document.readyState === "loading") {
      globalThis.document.addEventListener("DOMContentLoaded", close, { once: true });
    } else {
      close();
    }
  });
};

const makeServerInitialFlightStream = (): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  });

export class InitialFlightStream extends Context.Service<InitialFlightStream>()(
  "effront/client/initial-flight-stream/InitialFlightStream",
  {
    make: Effect.sync(() => {
      const environment: { window?: FlightWindow } = globalThis;
      const browser = environment.window;
      const stream = Predicate.isNullish(browser)
        ? makeServerInitialFlightStream()
        : makeBrowserInitialFlightStream(browser);
      return { stream };
    }),
  },
) {
  // oxlint-disable-next-line rules/no-readonly -- The browser stream service exposes a stable layer.
  public static readonly layer = Layer.effect(this, this.make);

  // oxlint-disable-next-line rules/no-readonly -- The test layer factory is a stable service reference.
  public static readonly layerTest = Layer.mock(this);
}
