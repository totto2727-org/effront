import { Effect } from "effect";
import { HttpMiddleware, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

const privateCacheControl = "private, no-store";

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
      const acceptsPage = ["text/html", "text/x-component"].some((type) => accept?.includes(type));
      const response = yield* handler;
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
