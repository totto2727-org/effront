import { createFromReadableStream } from "@vitejs/plugin-rsc/browser";
import { Deferred, Effect, Exit, Stream } from "effect";
import type { HttpClientResponse } from "effect/http";

import type { FlightPayload, ServerFnResult } from "#core/rsc/flight.ts";

import {
  FlightLoadError,
  flightRequests,
  flightResources,
  loadFailure,
} from "./flight-client-model.ts";
import type { DecodedFlight, FlightRequest } from "./flight-client-model.ts";
import { flightDecodeOptions } from "./flight-client-request.ts";
import { InitialFlightStream } from "./initial-flight-stream.ts";

const initialStartTime = 0;
const isQuery = flightRequests.$is("Query");

export const loadInitialFlight = Effect.gen(function* () {
  const initialFlight = yield* InitialFlightStream;
  const completed = Promise.withResolvers<true>();
  const stream = initialFlight.stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      flush: () => {
        completed.resolve(true);
      },
      transform: (chunk, controller) => {
        controller.enqueue(chunk);
      },
    }),
  );
  const options = import.meta.env.DEV ? { startTime: initialStartTime } : undefined;
  const payload = yield* Effect.tryPromise({
    catch: (cause) => new FlightLoadError({ cause, reason: "DecodeFailed" }),
    try: async () => createFromReadableStream<FlightPayload>(stream, options),
  });
  return {
    completed: Effect.promise(async () => completed.promise).pipe(Effect.asVoid),
    payload,
  } satisfies DecodedFlight;
});

const consume = Effect.fnUntraced(function* (
  response: HttpClientResponse.HttpClientResponse,
  release: Effect.Effect<void>,
) {
  const completion = yield* Deferred.make<true, FlightLoadError>();
  const body = yield* Stream.toReadableStreamEffect(
    response.stream.pipe(
      Stream.onExit((exit) =>
        Deferred.done(
          completion,
          exit.pipe(
            Exit.map(() => true as const),
            Exit.mapError((cause) => new FlightLoadError({ cause, reason: "RequestFailed" })),
          ),
        ),
      ),
      Stream.ensuring(release),
    ),
  );
  return { body, completed: Deferred.await(completion).pipe(Effect.asVoid) };
});

type ResponseOptions = Readonly<{
  release: Effect.Effect<void>;
  request: FlightRequest;
  resolvedUrl: URL;
  response: HttpClientResponse.HttpClientResponse;
  startTime: number;
}>;

// oxlint-disable-next-line rules/no-type-predicate -- The React decoder supplies the wire union. The test narrows its structural distinction without traversing the decoded route tree.
const hasResultDiscriminant = (value: FlightPayload | ServerFnResult): value is ServerFnResult =>
  // oxlint-disable-next-line rules/no-direct-tag-access -- React's Flight wire distinguishes the result from a route payload by the presence of this property.
  "_tag" in value;

export const decodeHttpFlight = Effect.fnUntraced(function* ({
  release,
  request,
  resolvedUrl,
  response,
  startTime,
}: ResponseOptions) {
  const { body, completed } = yield* consume(response, release);
  const options = flightDecodeOptions(request, startTime);
  const payload = yield* Effect.tryPromise({
    catch: (cause) => new FlightLoadError({ cause, reason: "DecodeFailed" }),
    try: async () => createFromReadableStream<FlightPayload | ServerFnResult>(body, options),
  });

  if (isQuery(request)) {
    if (!hasResultDiscriminant(payload)) {
      return yield* loadFailure(
        "Expected a Server Function result in the query response.",
        "DecodeFailed",
      );
    }
    return flightResources.Query({ completed, payload, release });
  }
  if (hasResultDiscriminant(payload)) {
    return yield* loadFailure("Expected a route payload in the Flight response.", "DecodeFailed");
  }
  return flightResources.Flight({ completed, payload, release, resolvedUrl });
});
