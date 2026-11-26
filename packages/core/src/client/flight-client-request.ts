import type { createTemporaryReferenceSet } from "@vitejs/plugin-rsc/browser";
import { Effect, Option, String } from "effect";
import { HttpBody, HttpClientRequest } from "effect/http";
import type { HttpClientResponse } from "effect/http";

import { FlightMediaType, ServerFnIdHeader } from "#core/rsc/flight.ts";

import { FlightLoadError, flightRequests, loadFailure } from "./flight-client-model.ts";
import type { FlightRequest } from "./flight-client-model.ts";

const successfulStatus = 200;
const firstRedirectStatus = 300;
const firstMediaType = 1;
const productionTiming = 0;
const isNavigation = flightRequests.$is("Navigation");

export const toHttpRequest = (request: FlightRequest): HttpClientRequest.HttpClientRequest =>
  isNavigation(request)
    ? HttpClientRequest.get(request.destination).pipe(
        HttpClientRequest.setHeader("accept", FlightMediaType),
      )
    : HttpClientRequest.post(request.destination).pipe(
        HttpClientRequest.setHeaders({
          accept: FlightMediaType,
          [ServerFnIdHeader]: request.id,
        }),
        HttpClientRequest.setBody(HttpBody.raw(request.body)),
      );

export const flightDecodeStart = (): number =>
  import.meta.env.DEV ? performance.now() : productionTiming;

export const flightDecodeOptions = (
  request: FlightRequest,
  startTime: number,
):
  | {
      startTime?: number;
      temporaryReferences?: ReturnType<typeof createTemporaryReferenceSet>;
    }
  | undefined => {
  const timing = import.meta.env.DEV ? { startTime } : undefined;
  if (isNavigation(request)) {
    return timing;
  }
  return { ...timing, temporaryReferences: request.temporaryReferences };
};

type ResponseIssue = Readonly<{ message: string; reason: FlightLoadError["reason"] }>;

const responseIssue = (
  response: HttpClientResponse.HttpClientResponse,
): Option.Option<ResponseIssue> => {
  if (response.status < successfulStatus || response.status >= firstRedirectStatus) {
    return Option.some({
      message: `Flight request failed with status ${response.status}.`,
      reason: "RequestFailed",
    });
  }
  const contentType = response.headers["content-type"];
  const [mediaType] = contentType?.split(";", firstMediaType) ?? [];
  return mediaType?.trim().toLowerCase() === FlightMediaType
    ? Option.none()
    : Option.some({
        message: `Expected a ${FlightMediaType} response, received ${contentType ?? "no content type"}.`,
        reason: "UnexpectedResponse",
      });
};

export const responseDestination = Effect.fnUntraced(function* (
  response: HttpClientResponse.HttpClientResponse,
  request: FlightRequest,
) {
  const issue = responseIssue(response);
  if (Option.isSome(issue)) {
    if (isNavigation(request)) {
      return Option.none();
    }
    return yield* loadFailure(issue.value.message, issue.value.reason);
  }

  // Effect reports the resolved URL after redirects, without the hash.
  const responseUrl = response.url;
  if (String.isEmpty(responseUrl)) {
    return yield* loadFailure(
      "Expected the Flight response to include a resolved URL.",
      "UnexpectedResponse",
    );
  }
  const url = yield* Effect.try({
    catch: (cause) => new FlightLoadError({ cause, reason: "UnexpectedResponse" }),
    try: () => new URL(responseUrl),
  });
  return Option.some(url);
});
