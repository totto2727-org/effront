import { Effect } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";

import { responseCache } from "./response-cache.ts";

type CachePolicy = Readonly<{
  browser: string | undefined;
  edge: string | undefined;
  variesByAccept: boolean;
}>;

export const htmlResponse = (): HttpServerResponse.HttpServerResponse =>
  HttpServerResponse.text("rendered", {
    contentType: "text/html",
    headers: { "cache-control": "private, no-store" },
  });

export const pageRequest = (headers: Record<string, string> = {}, method = "GET"): Request =>
  new Request("https://docs.example/guide", {
    headers: { accept: "text/html", ...headers },
    method,
  });

export const runCached = <E>(
  request: Request,
  app: Effect.Effect<HttpServerResponse.HttpServerResponse, E> = Effect.succeed(htmlResponse()),
): Effect.Effect<HttpServerResponse.HttpServerResponse, E> => {
  const serverRequest = HttpServerRequest.fromWeb(request);
  return app.pipe(
    responseCache,
    Effect.provideService(HttpServerRequest.HttpServerRequest, serverRequest),
  );
};

export const policy = (response: HttpServerResponse.HttpServerResponse): CachePolicy => ({
  browser: response.headers["cache-control"],
  edge: response.headers["cloudflare-cdn-cache-control"],
  variesByAccept: response.headers["vary"]?.split(", ").includes("accept") ?? false,
});

export const publicPolicy: CachePolicy = {
  browser: "public, max-age=0, must-revalidate",
  edge: "public, max-age=31536000",
  variesByAccept: true,
};

export const privatePolicy: CachePolicy = {
  browser: "private, no-store",
  edge: "private, no-store",
  variesByAccept: true,
};

export const readText = async (response: HttpServerResponse.HttpServerResponse): Promise<string> =>
  HttpServerResponse.toWeb(response).text();
