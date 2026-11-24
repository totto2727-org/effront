import { Context, Effect, Exit, Layer, Option, Scope } from "effect";
import { HttpClient } from "effect/http";
import type { HttpClientError } from "effect/http";

import { FlightLoadError, flightResources, impossibleResponse } from "./flight-client-model.ts";
import type { FlightRequest, flightRequests } from "./flight-client-model.ts";
import { flightDecodeStart, responseDestination, toHttpRequest } from "./flight-client-request.ts";
import { decodeHttpFlight, loadInitialFlight } from "./flight-client-stream.ts";
import { InitialFlightStream } from "./initial-flight-stream.ts";

export { FlightLoadError } from "./flight-client-model.ts";
export type { FlightRequest } from "./flight-client-model.ts";

type QueryRequest = ReturnType<typeof flightRequests.Query>;
type FlightResource = ReturnType<typeof flightResources.Flight>;
type QueryResource = ReturnType<typeof flightResources.Query>;
type DocumentResource = ReturnType<typeof flightResources.Document>;
type FlightLoad<Resource> = Effect.Effect<Resource, FlightLoadError, Scope.Scope>;

const isQuery = flightResources.$is("Query");
const isFlight = flightResources.$is("Flight");

interface ResponseLifetime {
  release: Effect.Effect<void>;
  scope: Scope.Closeable;
}

const requestFlight = Effect.fnUntraced(function* (
  client: HttpClient.HttpClient.With<HttpClientError.HttpClientError, Scope.Scope>,
  request: FlightRequest,
  { release, scope }: ResponseLifetime,
) {
  const webRequest = toHttpRequest(request);
  const startTime = flightDecodeStart();
  const response = yield* client.execute(webRequest).pipe(
    Scope.provide(scope),
    Effect.mapError((cause) => new FlightLoadError({ cause, reason: "RequestFailed" })),
  );
  const destination = yield* responseDestination(response, request);
  if (Option.isNone(destination)) {
    return flightResources.Document({ release });
  }
  return yield* decodeHttpFlight({
    release,
    request,
    resolvedUrl: destination.value,
    response,
    startTime,
  });
});

const makeFlightClient = Effect.gen(function* () {
  const httpClient = yield* HttpClient.HttpClient;
  const client = httpClient.pipe(HttpClient.withScope);
  const initialFlight = yield* InitialFlightStream;
  const loadInitial = loadInitialFlight.pipe(
    Effect.provideService(InitialFlightStream, initialFlight),
  );

  const loadAny = Effect.fnUntraced(function* (request: FlightRequest) {
    const parentScope = yield* Effect.scope;
    const scope = yield* Scope.fork(parentScope);
    const release = Scope.close(scope, Exit.void);
    const requestEffect = requestFlight(client, request, { release, scope });
    return yield* requestEffect.pipe(Effect.onError(() => release));
  });

  const load = (
    request: Exclude<FlightRequest, QueryRequest>,
  ): FlightLoad<FlightResource | DocumentResource> =>
    loadAny(request).pipe(
      Effect.map((resource) => {
        if (isQuery(resource)) {
          throw impossibleResponse("A navigation or mutation cannot return a query response.");
        }
        return resource;
      }),
    );

  const loadQuery = (request: QueryRequest): FlightLoad<QueryResource | DocumentResource> =>
    loadAny(request).pipe(
      Effect.map((resource) => {
        if (isFlight(resource)) {
          throw impossibleResponse("A query cannot return a route response.");
        }
        return resource;
      }),
    );

  return { load, loadInitial, loadQuery };
});

export class FlightClient extends Context.Service<FlightClient>()("effront/client/FlightClient", {
  make: makeFlightClient,
}) {
  // oxlint-disable-next-line rules/no-readonly -- The reference to the public client layer is fixed for this service.
  public static readonly layer = Layer.effect(this, this.make);

  // oxlint-disable-next-line rules/no-readonly -- Preserve the fixed reference used by test layers.
  public static readonly layerTest = Layer.mock(this);
}
