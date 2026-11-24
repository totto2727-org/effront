import { vi } from "@effect/vitest";
import { Data, Deferred, Effect, Layer } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import type { HttpClientRequest } from "effect/http";

import { FlightMediaType } from "#core/rsc/flight.ts";
import type { FlightPayload, ServerFnResult } from "#core/rsc/flight.ts";

import { flightRequests, flightResources } from "./flight-client-model.ts";
import type { FlightRequest } from "./flight-client-model.ts";
import { InitialFlightStream } from "./initial-flight-stream.ts";

// oxlint-disable-next-line unicorn/no-null -- The browser decodes null fields from the Flight wire.
const absent = null;
export const decodedPayload = {
  formState: absent,
  routeTree: { child: absent, content: absent, id: "root" },
  serverFnResult: absent,
} satisfies FlightPayload;
export const results = Data.taggedEnum<ServerFnResult>();

type Decoder = (
  stream: ReadableStream<Uint8Array>,
  options?: Readonly<{ startTime?: number; temporaryReferences?: unknown }>,
) => Promise<FlightPayload | ServerFnResult>;

export const decodeFlight = vi.fn<Decoder>();

vi.doMock("@vitejs/plugin-rsc/browser", () => ({ createFromReadableStream: decodeFlight }));
export const { FlightClient, FlightLoadError } = await import("./flight-client.ts");

export const resetDecode = Effect.sync(() => {
  decodeFlight.mockReset();
  decodeFlight.mockResolvedValue(decodedPayload);
});

export class InvalidFlight extends Data.TaggedError("InvalidFlight")<{ message: string }> {}

export const destination = new URL("https://effront.test/schedule/day-two");
export const home = new URL("https://effront.test/");
const navigation = flightRequests.Navigation({ destination });
export const actionId = "server-function-id";
export const encodedArguments = "encoded-arguments";

type QueryRequest = ReturnType<typeof flightRequests.Query>;
export type RouteRequest = Exclude<FlightRequest, QueryRequest>;
type Respond = (request: HttpClientRequest.HttpClientRequest, signal: AbortSignal) => Response;

export const transport = (respond: Respond): HttpClient.HttpClient =>
  HttpClient.make((request, _url, signal) => {
    const response = respond(request, signal);
    return Effect.succeed(HttpClientResponse.fromWeb(request, response));
  });

export const clientFor = Effect.fnUntraced(function* (
  http: HttpClient.HttpClient,
  stream: ReadableStream<Uint8Array> = new ReadableStream<Uint8Array>(),
) {
  const initial = InitialFlightStream.layerTest({ stream });
  const layer = FlightClient.layer.pipe(Layer.provide(initial));
  return yield* FlightClient.pipe(
    Effect.provide(layer),
    Effect.provideService(HttpClient.HttpClient, http),
  );
});

export const load = Effect.fnUntraced(function* (
  http: HttpClient.HttpClient,
  request: RouteRequest = navigation,
) {
  const client = yield* clientFor(http);
  return yield* client.load(request);
});

const isFlight = flightResources.$is("Flight");

export const requireFlight = (
  resource: Effect.Success<ReturnType<typeof load>>,
): Effect.Effect<ReturnType<typeof flightResources.Flight>> =>
  isFlight(resource) ? Effect.succeed(resource) : Effect.die("Expected a Flight response.");

export const flightResponse = (contentType: string = FlightMediaType): Response =>
  new Response(new Uint8Array(), { headers: { "content-type": contentType } });

export const pendingResponse = (signal: AbortSignal): Response => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      signal.addEventListener(
        "abort",
        () => {
          controller.error(signal.reason);
        },
        { once: true },
      );
    },
  });
  return new Response(body, { headers: { "content-type": FlightMediaType } });
};

interface TransportObservation {
  request: HttpClientRequest.HttpClientRequest;
  signal: AbortSignal;
}

export const observeTransport = Effect.fnUntraced(function* (
  respond: (signal: AbortSignal) => Response,
) {
  const observed = yield* Deferred.make<TransportObservation>();
  const http = transport((request, signal) => {
    Deferred.doneUnsafe(observed, Effect.succeed({ request, signal }));
    return respond(signal);
  });
  return { http, observed: Deferred.await(observed) };
});

export const observeDecoding = Effect.fnUntraced(function* (waitForRead: boolean) {
  const started = yield* Deferred.make<boolean>();
  const stopped = yield* Deferred.make<boolean>();
  const consume = async (stream: ReadableStream<Uint8Array>): Promise<void> => {
    const read = stream.getReader().read();
    Deferred.doneUnsafe(started, Effect.succeed(true));
    try {
      await read;
    } catch {
      Deferred.doneUnsafe(stopped, Effect.succeed(true));
    }
  };
  decodeFlight.mockImplementationOnce(async (stream) => {
    const reading = consume(stream);
    if (waitForRead) {
      await reading;
    }
    return decodedPayload;
  });
  return { started: Deferred.await(started), stopped: Deferred.await(stopped) };
});
