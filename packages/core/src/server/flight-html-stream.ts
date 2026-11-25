// Adapted from rsc-html-stream by Devon Govett.
// Copyright (c) 2024-present Devon Govett. Licensed under the MIT License; see THIRD-PARTY-NOTICES.md.

import { MutableRef, Predicate, String } from "effect";

const encoder = new TextEncoder();
const htmlTrailer = encoder.encode("</body></html>");
const emptyBytes = new Uint8Array();
const firstByte = 0;
const singleByte = 1;
const scriptNameOffset = 2;
const backslashCodePoint = 92;
const scriptEscape = globalThis.String.fromCodePoint(backslashCodePoint);

type StreamController = TransformStreamDefaultController<Uint8Array>;

export type FlightHtmlStreamOptions = Readonly<{
  nonce?: string;
}>;

const matchesTrailerPrefix = (bytes: Uint8Array, length: number): boolean => {
  const offset = bytes.byteLength - length;
  return (
    bytes[offset] === htmlTrailer[firstByte] &&
    htmlTrailer.subarray(firstByte, length).every((byte, index) => bytes[offset + index] === byte)
  );
};

const matchingTrailerLength = (bytes: Uint8Array, length: number): number => {
  if (length === firstByte || matchesTrailerPrefix(bytes, length)) {
    return length;
  }
  return matchingTrailerLength(bytes, length - singleByte);
};

const trailerPrefixLength = (bytes: Uint8Array): number =>
  matchingTrailerLength(bytes, Math.min(bytes.byteLength, htmlTrailer.byteLength));

const escapeInlineScript = (script: string): string =>
  script.replaceAll(/<!--|<\/[sS][cC][rR][iI][pP][tT]/gu, (match) =>
    match === "<!--"
      ? globalThis.String.raw`<\!--`
      : `</${scriptEscape}${match.slice(scriptNameOffset)}`,
  );

const toBase64 = (bytes: Uint8Array): string =>
  btoa(bytes.reduce((binary, byte) => binary + globalThis.String.fromCodePoint(byte), ""));

type FlightDestination = Readonly<{
  controller: StreamController;
  nonce: string | undefined;
}>;

const writeFlightValue = (value: string, { controller, nonce }: FlightDestination): void => {
  const script = escapeInlineScript(`(self.__FLIGHT_DATA||=[]).push(${value})`);
  const nonceAttribute = Predicate.isNullish(nonce) ? "" : ` nonce="${nonce}"`;
  controller.enqueue(encoder.encode(`<script${nonceAttribute}>${script}</script>`));
};

const writeFlightChunk = (
  decoder: TextDecoder,
  chunk: Uint8Array,
  destination: FlightDestination,
): void => {
  try {
    // A fatal streaming decoder can discard pending UTF-8 when binary data follows.
    // Encode incomplete UTF-8 as bytes to preserve the data exactly.
    const text = decoder.decode(chunk);
    if (String.isNonEmpty(text)) {
      writeFlightValue(JSON.stringify(text), destination);
    }
  } catch {
    const encoded = JSON.stringify(toBase64(chunk));
    writeFlightValue(
      `Uint8Array.from(atob(${encoded}),character=>character.codePointAt(0))`,
      destination,
    );
  }
};

const writeFlightStream = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  destination: FlightDestination,
): Promise<void> => {
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  // oxlint-disable-next-line typescript/no-unnecessary-condition -- EOF is signaled by the awaited reader result.
  while (true) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Read and write one Flight chunk at a time to preserve order and bound memory.
    const result = await reader.read();
    if (result.done) {
      return;
    }
    writeFlightChunk(decoder, result.value, destination);
  }
};

type HtmlWriter = Readonly<{
  finish: (controller: StreamController) => void;
  write: (chunk: Uint8Array, controller: StreamController) => void;
}>;

const makeHtmlWriter = (): HtmlWriter => {
  const pending = MutableRef.make(emptyBytes);

  return {
    finish(controller) {
      const tail = MutableRef.get(pending);
      if (tail.byteLength !== htmlTrailer.byteLength && tail.byteLength > firstByte) {
        controller.enqueue(tail);
      }
    },
    write(chunk, controller) {
      const tail = MutableRef.get(pending);
      const combined = new Uint8Array(tail.byteLength + chunk.byteLength);
      combined.set(tail);
      combined.set(chunk, tail.byteLength);
      const bodyLength = combined.byteLength - trailerPrefixLength(combined);
      if (bodyLength > firstByte) {
        controller.enqueue(combined.subarray(firstByte, bodyLength));
      }
      MutableRef.set(pending, combined.slice(bodyLength));
    },
  };
};

const settleFlightCancellation = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  reason: unknown,
): Promise<void> => {
  try {
    await reader.cancel(reason);
  } catch {
    // A failed Flight stream already reports the read failure to its consumer.
  }
};

type FlightBody = Readonly<{
  cancel: (reason: unknown) => void;
  reader: ReadableStreamDefaultReader<Uint8Array>;
  release: () => void;
}>;

const retainFlight = (stream: ReadableStream<Uint8Array>): FlightBody => {
  const reader = stream.getReader();
  const released = MutableRef.make(false);
  const release = (): void => {
    if (!MutableRef.get(released)) {
      MutableRef.set(released, true);
      reader.releaseLock();
    }
  };
  const cancel = (reason: unknown): void => {
    if (!MutableRef.get(released)) {
      // Cancelling a tee branch settles its pending reads immediately.
      // The sibling may need the request scope's abort signal before cancellation completes.
      // oxlint-disable-next-line typescript/no-floating-promises -- Release the request scope without waiting for the tee sibling.
      settleFlightCancellation(reader, reason);
      release();
    }
  };
  return { cancel, reader, release };
};

const readHtml = (
  stream: ReadableStream<Uint8Array>,
  cancelFlight: FlightBody["cancel"],
): ReadableStream<Uint8Array> => {
  const htmlReader = stream.getReader();
  const ended = MutableRef.make(false);
  const finish = (controller: ReadableStreamDefaultController<Uint8Array>): void => {
    MutableRef.set(ended, true);
    controller.close();
    htmlReader.releaseLock();
  };
  const failRead = (
    controller: ReadableStreamDefaultController<Uint8Array>,
    error: unknown,
  ): void => {
    MutableRef.set(ended, true);
    cancelFlight(error);
    controller.error(error);
    htmlReader.releaseLock();
  };
  // A TransformStream cancellation can wait for an already-running flush.
  // Cancel the pending Flight read before cancelling the HTML reader.
  return new ReadableStream({
    async cancel(reason) {
      MutableRef.set(ended, true);
      cancelFlight(reason);
      try {
        await htmlReader.cancel(reason);
      } finally {
        htmlReader.releaseLock();
      }
    },
    async pull(controller) {
      try {
        const result = await htmlReader.read();
        if (MutableRef.get(ended)) {
          return;
        }
        if (result.done) {
          finish(controller);
        } else {
          controller.enqueue(result.value);
        }
      } catch (error) {
        failRead(controller, error);
      }
    },
  });
};

type FlightTransform = Pick<TransformStream<Uint8Array, Uint8Array>, "readable" | "writable">;

export const injectFlightPayload = (
  flightStream: ReadableStream<Uint8Array>,
  options?: FlightHtmlStreamOptions,
): FlightTransform => {
  const htmlWriter = makeHtmlWriter();
  const flight = retainFlight(flightStream);
  const transform = new TransformStream<Uint8Array, Uint8Array>({
    async flush(controller) {
      try {
        htmlWriter.finish(controller);
        // HTML chunks can end inside any token.
        // The SSR tee branch keeps pulling Flight while its browser branch queues.
        await writeFlightStream(flight.reader, { controller, nonce: options?.nonce });
        controller.enqueue(htmlTrailer);
      } catch (error) {
        controller.error(error);
      } finally {
        flight.release();
      }
    },
    transform(chunk, controller) {
      htmlWriter.write(chunk, controller);
    },
  });
  const readable = readHtml(transform.readable, flight.cancel);
  return { readable, writable: transform.writable };
};
