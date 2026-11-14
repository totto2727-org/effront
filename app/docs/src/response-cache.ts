import { Effect } from "effect";
import { HttpMiddleware, HttpServerRequest, HttpServerResponse } from "effect/http";
import Negotiator from "negotiator";

const privateCacheControl = "private, no-store";

const acceptsRepresentation = (accept: string | undefined, contentType: string | undefined) => {
  if (!accept || !contentType) return false;
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase();
  if (mediaType !== "text/html" && mediaType !== "text/x-component") return false;

  const negotiator = new Negotiator({ headers: { accept } });
  const ranges = negotiator.mediaTypes().map((type) => type.toLowerCase());

  // Flight needs an explicit opt-in. Only HTML gains the global wildcard fallback.
  return (
    (ranges.includes(mediaType) || (mediaType === "text/html" && ranges.includes("*/*"))) &&
    negotiator.mediaType([contentType]) !== undefined
  );
};

const varyFor = (vary: string | undefined) => {
  const values = new Set(
    (vary ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  values.add("accept");
  return [...values].join(", ");
};

/** Opts public docs responses into native Workers Cache without touching their bodies. */
export const responseCache = HttpMiddleware.make(
  <E, R>(handler: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const accept = request.headers["accept"];
      const response = yield* handler;
      const acceptsPage = acceptsRepresentation(accept, response.headers["content-type"]);
      const vary = varyFor(response.headers["vary"]);
      // This docs-only opt-in overrides core's conservative private/no-store default.
      const publicResponse = request.method === "GET" && acceptsPage && response.status === 200;

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
