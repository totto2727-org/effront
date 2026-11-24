// Vite replaces `import.meta.env.DEV` at compile time.
import { Context, Deferred, Effect, Exit, Layer, Schema, Scope, Stream, String } from "effect";
import { HttpBody, HttpClient, HttpClientRequest } from "effect/http";
import { createFromReadableStream, createTemporaryReferenceSet } from "@vitejs/plugin-rsc/browser";

import { FlightMediaType, ServerFnIdHeader } from "../rsc/flight.ts";
import type { FlightPayload, ServerFnResult } from "../rsc/flight.ts";
import { InitialFlightStream } from "./initial-flight-stream.ts";

export class FlightLoadError extends Schema.TaggedError<FlightLoadError>()("FlightLoadError", {
  cause: Schema.Defect(),
  reason: Schema.Literals(["RequestFailed", "UnexpectedResponse", "DecodeFailed"]),
}) {}

export type FlightRequest =
  | Readonly<{
      _tag: "Navigation";
      destination: URL;
    }>
  | Readonly<{
      _tag: "ServerFunction";
      body: BodyInit;
      destination: URL;
      id: string;
      temporaryReferences: ReturnType<typeof createTemporaryReferenceSet>;
    }>
  | Readonly<{
      _tag: "Query";
      body: BodyInit;
      destination: URL;
      id: string;
      temporaryReferences: ReturnType<typeof createTemporaryReferenceSet>;
    }>;

type DecodedFlight = Readonly<{
  completed: Effect.Effect<void, FlightLoadError>;
  payload: FlightPayload;
}>;

type FlightResource = DecodedFlight &
  Readonly<{
    _tag: "Flight";
    release: Effect.Effect<void>;
    resolvedUrl: URL;
  }>;

type QueryResource = Readonly<{
  _tag: "Query";
  completed: Effect.Effect<void, FlightLoadError>;
  payload: ServerFnResult;
  release: Effect.Effect<void>;
}>;

type DocumentResource = Readonly<{
  _tag: "Document";
  release: Effect.Effect<void>;
}>;

export class FlightClient extends Context.Service<FlightClient>()("effront/client/FlightClient", {
  make: Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient;
    const initialFlight = yield* InitialFlightStream;

    const loadInitial = Effect.gen(function* () {
      const completed = Promise.withResolvers<void>();
      const stream = initialFlight.stream.pipeThrough(
        new TransformStream({
          flush: () => completed.resolve(),
          transform: (chunk, controller) => controller.enqueue(chunk),
        }),
      );
      const payload = yield* Effect.tryPromise({
        try: () =>
          createFromReadableStream<FlightPayload>(
            stream,
            import.meta.env.DEV ? { startTime: 0 } : undefined,
          ),
        catch: (cause) => new FlightLoadError({ cause, reason: "DecodeFailed" }),
      });

      return {
        completed: Effect.promise(() => completed.promise),
        payload,
      } satisfies DecodedFlight;
    });

    const loadAny = Effect.fnUntraced(function* (flightRequest: FlightRequest) {
      const parentScope = yield* Effect.scope;
      const responseScope = yield* Scope.fork(parentScope);
      const release = Scope.close(responseScope, Exit.void);

      return yield* Effect.gen(function* () {
        const client = httpClient.pipe(HttpClient.withScope);
        const request =
          flightRequest._tag === "Navigation"
            ? HttpClientRequest.get(flightRequest.destination).pipe(
                HttpClientRequest.setHeader("accept", FlightMediaType),
              )
            : HttpClientRequest.post(flightRequest.destination).pipe(
                HttpClientRequest.setHeaders({
                  accept: FlightMediaType,
                  [ServerFnIdHeader]: flightRequest.id,
                }),
                HttpClientRequest.setBody(HttpBody.raw(flightRequest.body)),
              );
        const requestStartTime = import.meta.env.DEV ? performance.now() : 0;
        const response = yield* client.execute(request).pipe(
          Scope.provide(responseScope),
          Effect.mapError(
            (cause) =>
              new FlightLoadError({
                cause,
                reason: "RequestFailed",
              }),
          ),
        );
        if (response.status < 200 || response.status >= 300) {
          if (flightRequest._tag === "Navigation") {
            return { _tag: "Document", release } satisfies DocumentResource;
          }
          return yield* new FlightLoadError({
            cause: new Error(`Flight request failed with status ${response.status}.`),
            reason: "RequestFailed",
          });
        }
        const contentType = response.headers["content-type"]
          ?.split(";", 1)[0]
          ?.trim()
          .toLowerCase();
        if (contentType !== FlightMediaType) {
          if (flightRequest._tag === "Navigation") {
            return { _tag: "Document", release } satisfies DocumentResource;
          }
          return yield* new FlightLoadError({
            cause: new Error(
              `Expected a ${FlightMediaType} response, received ${response.headers["content-type"] ?? "no content type"}.`,
            ),
            reason: "UnexpectedResponse",
          });
        }

        // Effect exposes the resolved URL, including a followed redirect and excluding the hash.
        const responseUrl = response.url;
        if (String.isEmpty(responseUrl)) {
          return yield* new FlightLoadError({
            cause: new Error("Expected the Flight response to include a resolved URL."),
            reason: "UnexpectedResponse",
          });
        }
        const resolvedUrl = yield* Effect.try({
          try: () => new URL(responseUrl),
          catch: (cause) =>
            new FlightLoadError({
              cause,
              reason: "UnexpectedResponse",
            }),
        });

        const completed = yield* Deferred.make<void, FlightLoadError>();
        const responseBody = yield* Stream.toReadableStreamEffect(
          response.stream.pipe(
            Stream.onExit((exit) =>
              Deferred.done(
                completed,
                exit.pipe(
                  Exit.mapError(
                    (cause) =>
                      new FlightLoadError({
                        cause,
                        reason: "RequestFailed",
                      }),
                  ),
                  Exit.asVoid,
                ),
              ),
            ),
            Stream.ensuring(release),
          ),
        );
        const decodeOptions =
          flightRequest._tag !== "Navigation"
            ? import.meta.env.DEV
              ? {
                  startTime: requestStartTime,
                  temporaryReferences: flightRequest.temporaryReferences,
                }
              : { temporaryReferences: flightRequest.temporaryReferences }
            : import.meta.env.DEV
              ? {
                  startTime: requestStartTime,
                }
              : undefined;
        const payload = yield* Effect.tryPromise({
          try: () =>
            createFromReadableStream<FlightPayload | ServerFnResult>(responseBody, decodeOptions),
          catch: (cause) =>
            new FlightLoadError({
              cause,
              reason: "DecodeFailed",
            }),
        });

        if (flightRequest._tag === "Query") {
          if (!("_tag" in payload)) {
            return yield* new FlightLoadError({
              cause: new Error("Expected a Server Function result in the query response."),
              reason: "DecodeFailed",
            });
          }
          return {
            _tag: "Query",
            completed: Deferred.await(completed),
            payload,
            release,
          } satisfies QueryResource;
        }
        if ("_tag" in payload) {
          return yield* new FlightLoadError({
            cause: new Error("Expected a route payload in the Flight response."),
            reason: "DecodeFailed",
          });
        }
        return {
          _tag: "Flight",
          completed: Deferred.await(completed),
          payload,
          release,
          resolvedUrl,
        } satisfies FlightResource;
      }).pipe(Effect.onError(() => release));
    });

    const load = (request: Exclude<FlightRequest, Readonly<{ _tag: "Query" }>>) =>
      loadAny(request).pipe(
        Effect.map((resource) => {
          if (resource._tag === "Query") {
            throw new TypeError("A navigation or mutation cannot return a query response.");
          }
          return resource;
        }),
      );
    const loadQuery = (request: Extract<FlightRequest, Readonly<{ _tag: "Query" }>>) =>
      loadAny(request).pipe(
        Effect.map((resource) => {
          if (resource._tag === "Flight") {
            throw new TypeError("A query cannot return a route response.");
          }
          return resource;
        }),
      );

    return { load, loadInitial, loadQuery };
  }),
}) {
  static readonly layer = Layer.effect(this, this.make);

  static readonly layerTest = Layer.mock(this);
}
