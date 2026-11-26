import { expect, it } from "@effect/vitest";
import { Deferred, Effect, Fiber } from "effect";
import { HttpClient } from "effect/http";

import {
  clientFor,
  decodeFlight,
  decodedPayload,
  FlightLoadError,
  flightResponse,
  InvalidFlight,
  load,
  observeDecoding,
  observeTransport,
  pendingResponse,
  requireFlight,
  resetDecode,
} from "./flight-client.fixture.ts";

const oneByte = [1];

const embeddedLoad = Effect.gen(function* () {
  const source = new TransformStream<Uint8Array, Uint8Array>();
  const writer = source.writable.getWriter();
  const reading = yield* Deferred.make<ReadableStreamDefaultReader<Uint8Array>>();
  decodeFlight.mockImplementationOnce(async (stream) => {
    const reader = stream.getReader();
    await reader.read();
    Deferred.doneUnsafe(reading, Effect.succeed(reader));
    return decodedPayload;
  });
  const http = HttpClient.make(() => Effect.die("Unexpected HTTP request."));
  const client = yield* clientFor(http, source.readable);
  const loading = yield* Effect.forkChild(client.loadInitial);
  yield* Effect.promise(async () => writer.write(new Uint8Array(oneByte)));
  const resource = yield* Fiber.join(loading);
  return { reading, resource, writer };
});

it.effect("loads the embedded initial Flight before the rest of its stream", () =>
  Effect.gen(function* () {
    yield* resetDecode;
    const { reading, resource, writer } = yield* embeddedLoad;
    const completed = yield* Effect.forkChild(resource.completed);
    yield* Effect.yieldNow;
    expect(resource.payload).toBe(decodedPayload);
    expect(completed.pollUnsafe()).toBeUndefined();

    const reader = yield* Deferred.await(reading);
    yield* Effect.all(
      [Effect.promise(async () => writer.close()), Effect.promise(async () => reader.read())],
      { concurrency: "unbounded" },
    );
    yield* Fiber.join(completed);
  }),
);

it.effect("keeps streamed chunks cancellable after the root payload resolves", () =>
  Effect.gen(function* () {
    yield* resetDecode;
    const { stopped } = yield* observeDecoding(false);
    const { http, observed } = yield* observeTransport(pendingResponse);
    const resource = yield* load(http);
    const response = yield* requireFlight(resource);
    yield* response.release;
    yield* stopped;
    const { signal } = yield* observed;
    expect([response.payload, signal.aborted]).toStrictEqual([decodedPayload, true]);
  }),
);

it.effect("closes the response scope when Flight reaches EOF", () =>
  Effect.gen(function* () {
    yield* resetDecode;
    decodeFlight.mockImplementationOnce(async (stream) => {
      const reader = stream.getReader();
      await reader.read();
      return decodedPayload;
    });
    const { http, observed } = yield* observeTransport(() => flightResponse());
    const resource = yield* load(http);
    const response = yield* requireFlight(resource);
    const { signal } = yield* observed;
    expect([response.payload, signal.aborted]).toStrictEqual([decodedPayload, true]);
  }),
);

it.effect("cancels an unfinished decoded stream when the browser scope closes", () =>
  Effect.gen(function* () {
    yield* resetDecode;
    const { stopped } = yield* observeDecoding(false);
    const { http, observed } = yield* observeTransport(pendingResponse);
    yield* Effect.scoped(load(http));
    yield* stopped;
    const { signal } = yield* observed;
    expect(signal.aborted).toBe(true);
  }),
);

it.effect("releases the Flight transport when decoding fails", () =>
  Effect.gen(function* () {
    yield* resetDecode;
    decodeFlight.mockRejectedValueOnce(new InvalidFlight({ message: "invalid Flight payload" }));
    const { http, observed } = yield* observeTransport(pendingResponse);
    const error = yield* load(http).pipe(Effect.flip);
    const { signal } = yield* observed;
    expect(error).toBeInstanceOf(FlightLoadError);
    expect([error.reason, signal.aborted]).toStrictEqual(["DecodeFailed", true]);
  }),
);

it.effect("cancels Flight response consumption when loading is interrupted", () =>
  Effect.gen(function* () {
    yield* resetDecode;
    const { started, stopped } = yield* observeDecoding(true);
    const { http, observed } = yield* observeTransport(pendingResponse);
    const loading = yield* Effect.forkChild(load(http));
    yield* started;
    yield* Fiber.interrupt(loading);
    yield* stopped;
    const { signal } = yield* observed;
    expect(signal.aborted).toBe(true);
  }),
);
