import { Effect, Predicate, String } from "effect";
import { HttpMiddleware, HttpServerRequest, HttpServerResponse } from "effect/http";
import Negotiator from "negotiator";

const privateCacheControl = "private, no-store";
const okStatus = 200;

const acceptsRepresentation = (
  accept: string | undefined,
  contentType: string | undefined,
): boolean => {
  if (
    Predicate.isNullish(accept) ||
    String.isEmpty(accept) ||
    Predicate.isNullish(contentType) ||
    String.isEmpty(contentType)
  ) {
    return false;
  }
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase();
  if (mediaType !== "text/html" && mediaType !== "text/x-component") {
    return false;
  }

  return Predicate.isNotNullish(new Negotiator({ headers: { accept } }).mediaType([contentType]));
};

const varyFor = (vary: string | undefined): string => {
  const existing = (vary ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...existing, "accept"])].join(", ");
};

/** Opts public docs responses into native Workers Cache without touching their bodies. */
export const responseCache = HttpMiddleware.make(
  <E, R>(handler: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const { accept } = request.headers;
      const response = yield* handler;
      const acceptsPage = acceptsRepresentation(accept, response.headers["content-type"]);
      const vary = varyFor(response.headers["vary"]);
      // This docs-only opt-in overrides core's conservative private/no-store default.
      const publicResponse =
        request.method === "GET" && acceptsPage && response.status === okStatus;

      return HttpServerResponse.setHeaders(response, {
        "cache-control": publicResponse
          ? "public, max-age=0, must-revalidate"
          : privateCacheControl,
        "cloudflare-cdn-cache-control": publicResponse
          ? "public, max-age=31536000"
          : privateCacheControl,
        vary,
      });
    }),
);
