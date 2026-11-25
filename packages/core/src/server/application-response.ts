import { Effect, Predicate, Stream, String } from "effect";
import type { Scope } from "effect";
import { HttpEffect, HttpServerResponse } from "effect/http";
import type { HttpRouter } from "effect/http";

import { FlightMediaType } from "#core/rsc/flight.ts";
import type { FlightRender, FlightRenderer } from "./flight-renderer.tsx";
import type { HtmlRenderError } from "./html-render-error.ts";
import { HtmlRenderer } from "./html-renderer.tsx";
import { responseOk } from "./request-outcome.ts";
import type { RequestOutcome } from "./request-outcome.ts";
import type { ServerFnRequestError } from "./server-fn-request-error.ts";
import type { ServerFnRequestFailure } from "./server-fn-request.ts";

export type PageResponse<Services, AdditionalError = never> = Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  HtmlRenderError | AdditionalError,
  Services | FlightRenderer | HtmlRenderer | HttpRouter.RouteContext | Scope.Scope
>;

export type MutationResponse<Services> = PageResponse<
  Services | HttpRouter.Provided,
  Exclude<ServerFnRequestFailure, ServerFnRequestError>
>;

export type QueryResponse<Services> = Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  never,
  Services | FlightRenderer | HttpRouter.Provided | Scope.Scope
>;

const dynamicResponseHeaders = { "cache-control": "private, no-store" } as const;
const notFoundStatus = 404;

const appendAcceptVary = (vary: string | undefined): string => {
  if (Predicate.isNullish(vary) || String.isEmpty(vary.trim())) {
    return "Accept";
  }
  const fields = new Set(vary.split(",").map((field) => field.trim().toLowerCase()));
  return fields.has("*") || fields.has("accept") ? vary : `${vary}, Accept`;
};

const acceptVary: HttpEffect.PreResponseHandler = (_request, response) =>
  Effect.succeed(
    HttpServerResponse.setHeader(response, "vary", appendAcceptVary(response.headers["vary"])),
  );

export const withAcceptVary = HttpEffect.withPreResponseHandler(acceptVary);

const streamBody = (
  stream: ReadableStream<Uint8Array>,
  release: FlightRender["release"],
  releaseLockOnEnd?: boolean,
): Stream.Stream<Uint8Array, unknown> =>
  Stream.fromReadableStream({
    evaluate: () => stream,
    onError: (cause) => cause,
    releaseLockOnEnd,
  }).pipe(Stream.ensuring(release));

export const flightResponse = (
  flight: FlightRender,
  status: RequestOutcome["status"] = responseOk,
): HttpServerResponse.HttpServerResponse =>
  HttpServerResponse.stream(streamBody(flight.stream, flight.release, true), {
    contentType: `${FlightMediaType};charset=utf-8`,
    headers: dynamicResponseHeaders,
    status,
  });

const htmlResponse = (
  stream: ReadableStream<Uint8Array>,
  flight: FlightRender,
  status: RequestOutcome["status"],
): HttpServerResponse.HttpServerResponse =>
  HttpServerResponse.stream(streamBody(stream, flight.release), {
    contentType: "text/html;charset=utf-8",
    headers: dynamicResponseHeaders,
    status,
  });

export const negotiatePageResponse = Effect.fnUntraced(function* (
  accept: string | undefined,
  flight: FlightRender,
  { formState, status }: Pick<RequestOutcome, "formState" | "status">,
) {
  if (accept === FlightMediaType) {
    return flightResponse(flight, status);
  }
  const htmlRenderer = yield* HtmlRenderer;
  const htmlStream = yield* htmlRenderer
    .render({ flight, formState })
    .pipe(Effect.onError(() => flight.release));
  return htmlResponse(htmlStream, flight, status);
});

export const pageNotFound = (): HttpServerResponse.HttpServerResponse =>
  HttpServerResponse.empty({ headers: dynamicResponseHeaders, status: notFoundStatus });

export const serverFnRequestFailureResponse = (
  failure: ServerFnRequestError,
): Effect.Effect<HttpServerResponse.HttpServerResponse> =>
  Effect.succeed(
    HttpServerResponse.text(failure.message, {
      headers: dynamicResponseHeaders,
      status: failure.status,
    }),
  );
