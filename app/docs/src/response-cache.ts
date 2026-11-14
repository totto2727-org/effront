import { Effect } from "effect";
import { HttpMiddleware, HttpServerRequest, HttpServerResponse } from "effect/http";

const privateCacheControl = "private, no-store";

const acceptsRepresentation = (accept: string | undefined, contentType: string | undefined) => {
  const mediaType = contentType?.split(";")[0]?.trim().toLowerCase();
  if (mediaType !== "text/html" && mediaType !== "text/x-component") return false;

  let specificity = -1;
  let quality = 0;
  for (const range of (accept ?? "").toLowerCase().split(",")) {
    const [type, ...parameters] = range.split(";").map((value) => value.trim());
    const rank = type === mediaType ? 2 : type === "text/*" ? 1 : type === "*/*" ? 0 : -1;
    if (rank < 0) continue;
    const weights = parameters
      .map((parameter) => parameter.split("=").map((value) => value.trim()))
      .filter(([name]) => name === "q");
    const weight =
      weights.length === 0 ? "1" : weights[0]?.length === 2 ? (weights[0][1] ?? "") : "";
    const value =
      weights.length <= 1 && /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(weight)
        ? Number(weight)
        : 0;
    if (rank > specificity) {
      specificity = rank;
      quality = value;
    } else if (rank === specificity) {
      quality = Math.min(quality, value);
    }
  }

  // Flight needs an explicit opt-in. Only HTML gains the global wildcard fallback.
  return quality > 0 && (specificity === 2 || (mediaType === "text/html" && specificity === 0));
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
