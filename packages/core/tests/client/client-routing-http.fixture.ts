import { Effect } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

const flightContentType = "text/x-component";
const firstChunk = 1;

const flightResponse = (body: BodyInit, contentType = flightContentType): Response =>
  new Response(body, { headers: { "content-type": contentType } });

export const makeHttpClient = (
  requestedUrls: string[] = [],
  contentType = flightContentType,
): HttpClient.HttpClient =>
  HttpClient.make((request) =>
    Effect.sync(() => {
      requestedUrls.push(request.url);
      const flight = flightResponse(new Uint8Array(), contentType);
      const response = HttpClientResponse.fromWeb(request, flight);
      Object.defineProperty(response, "url", {
        value: "https://effront.test/schedule/day-two",
      });
      return response;
    }),
  );

export const makeInvalidFlightClient = (): HttpClient.HttpClient =>
  HttpClient.make(() =>
    Effect.sync(() => {
      const invalidFlight = flightResponse(new Uint8Array());
      return HttpClientResponse.fromWeb(HttpClientRequest.empty, invalidFlight);
    }),
  );

type StreamingClient = Readonly<{
  httpClient: HttpClient.HttpClient;
  responseSignals: AbortSignal[];
}>;

const streamUntilAbort = (signal: AbortSignal): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start: (controller) => {
      controller.enqueue(Uint8Array.of(firstChunk));
      signal.addEventListener(
        "abort",
        () => {
          controller.error(signal.reason);
        },
        { once: true },
      );
    },
  });

export const makeStreamingHttpClient = (): StreamingClient => {
  const responseSignals: AbortSignal[] = [];
  const httpClient = HttpClient.make((request, _url, signal) =>
    Effect.sync(() => {
      responseSignals.push(signal);
      return HttpClientResponse.fromWeb(request, flightResponse(streamUntilAbort(signal)));
    }),
  );
  return { httpClient, responseSignals };
};
