import { Effect } from "effect";
import {
  Cookies,
  HttpMiddleware,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";

const flightMediaType = "text/x-component";
const privateCacheControl = "private, no-store";

const varyFor = (vary: string | undefined) => {
  const values = new Set(
    (vary ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  // Partition public cache entries before the Worker checks request credentials.
  for (const name of ["accept", "cookie", "authorization"]) {
    values.add(name);
  }
  return [...values].join(", ");
};

/** Opts public docs responses into native Workers Cache without touching their bodies. */
export const responseCache = (options: { readonly development?: boolean | undefined }) =>
  HttpMiddleware.make(<E, R>(handler: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const flight = request.headers["accept"] === flightMediaType;
      const response = yield* handler;
      const vary = varyFor(response.headers["vary"]);
      const contentType = response.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase();
      // This docs-only opt-in overrides core's conservative private/no-store default.
      const publicResponse =
        !options.development &&
        request.method === "GET" &&
        request.headers["cookie"] === undefined &&
        request.headers["authorization"] === undefined &&
        request.headers["range"] === undefined &&
        response.status === 200 &&
        response.headers["set-cookie"] === undefined &&
        Cookies.isEmpty(response.cookies) &&
        response.headers["content-range"] === undefined &&
        !vary.split(", ").includes("*") &&
        contentType === (flight ? flightMediaType : "text/html");

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
