import { Effect, Stream } from "effect";
import { Cookies, HttpBody, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

const flightMediaType = "text/x-component";
const browserCacheControl = "public, max-age=0, must-revalidate";
const edgeCacheControl = "public, max-age=31536000";
const cachePrefix = "/__effront-response-cache";
const maxCachedBodyBytes = 2 * 1024 * 1024;

type CacheStore = Pick<Cache, "match" | "put">;

type ResponseCacheOptions = {
  readonly buildId: string;
  readonly cache?: CacheStore | undefined;
  readonly development?: boolean | undefined;
  readonly maxBodyBytes?: number | undefined;
};

type Representation = "html" | "rsc";

const headersFor = (cache: "MISS") => ({
  "cache-control": browserCacheControl,
  "x-effront-cache": cache,
});

const requestHeadersPreventCaching = (headers: Readonly<Record<string, string | undefined>>) =>
  headers["authorization"] !== undefined ||
  headers["cookie"] !== undefined ||
  headers["range"] !== undefined;

const representationFor = (
  headers: Readonly<Record<string, string | undefined>>,
): Representation => (headers["accept"] === flightMediaType ? "rsc" : "html");

const cacheKey = (requestUrl: string, buildId: string, representation: Representation) => {
  const url = new URL(requestUrl, "https://effront.local");
  url.pathname = `${cachePrefix}/${encodeURIComponent(buildId)}/${representation}${url.pathname}`;
  return new Request(url.toString());
};

const concat = (chunks: ReadonlyArray<Uint8Array>, length: number) => {
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  return body;
};

const bypassResponse = (response: HttpServerResponse.HttpServerResponse, buildId: string) =>
  HttpServerResponse.setHeaders(response, {
    "cache-control": "private, no-store",
    "x-effront-build-id": buildId,
    "x-effront-cache": "BYPASS",
  });

const varyWithAccept = (vary: string | undefined) => {
  const values = new Set(
    (vary ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  values.add("accept");
  return [...values].join(", ");
};

const hasWildcardVary = (vary: string | undefined) =>
  (vary ?? "").split(",").some((value) => value.trim() === "*");

const variesOnlyByAccept = (vary: string | undefined) =>
  (vary ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .every((value) => value === "accept");

const responseContentMatches = (
  response: HttpServerResponse.HttpServerResponse,
  representation: Representation,
) =>
  representation === "rsc"
    ? response.headers["content-type"]?.startsWith(flightMediaType) === true
    : response.headers["content-type"]?.startsWith("text/html") === true;

const storedResponse = (body: ArrayBuffer, response: HttpServerResponse.HttpServerResponse) => {
  const headers = new Headers(response.headers);
  headers.set("cache-control", edgeCacheControl);
  return new Response(body, { headers, status: response.status, statusText: response.statusText });
};

/**
 * Adds a build-scoped Cloudflare Cache API layer around an Effect HTTP handler.
 *
 * The cache key carries the worker build identifier and representation explicitly,
 * rather than relying on `Vary: Accept`. Cached streamed bodies are collected only
 * up to a fixed bound and put only after their source stream completes successfully.
 */
export const withResponseCache = <E, R>(
  handler: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
  options: ResponseCacheOptions,
): Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  E,
  R | HttpServerRequest.HttpServerRequest
> =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const representation = representationFor(request.headers);
    const diagnostics = { "x-effront-build-id": options.buildId };

    if (options.development) {
      const response = yield* handler;
      return bypassResponse(response, options.buildId);
    }

    if (representation === "rsc" && request.headers["x-effront-build-id"] !== options.buildId) {
      return HttpServerResponse.empty({
        status: 409,
        headers: {
          ...diagnostics,
          "cache-control": "private, no-store",
          "x-effront-cache": "BYPASS",
        },
      });
    }

    const cache =
      options.cache ??
      (globalThis as typeof globalThis & { readonly caches?: { readonly default?: CacheStore } })
        .caches?.default;
    const eligible =
      cache !== undefined &&
      request.method === "GET" &&
      !requestHeadersPreventCaching(request.headers);

    if (!eligible) {
      const response = yield* handler;
      return bypassResponse(response, options.buildId);
    }

    const key = cacheKey(request.originalUrl, options.buildId, representation);
    const hit: Response | undefined = yield* Effect.tryPromise(() => cache.match(key)).pipe(
      Effect.map((response) => response ?? undefined),
      Effect.catch(() => Effect.succeed(undefined)),
    );
    if (hit !== undefined) {
      return HttpServerResponse.fromWeb(
        new Response(hit.body, {
          headers: {
            ...Object.fromEntries(hit.headers),
            ...diagnostics,
            "cache-control": browserCacheControl,
            vary: varyWithAccept(hit.headers.get("vary") ?? undefined),
            "x-effront-cache": "HIT",
          },
          status: hit.status,
          statusText: hit.statusText,
        }),
      );
    }

    // Keep the Worker construction graph free of core's React server modules.
    // This cache path runs only for an eligible cache miss inside a request.
    const { RenderErrorObserver } = yield* Effect.promise(() => import("@effront/core/http"));
    let renderFailed = false;
    const original = yield* handler.pipe(
      Effect.provideService(RenderErrorObserver, () => {
        renderFailed = true;
      }),
    );
    const cacheable =
      original.status === 200 &&
      original.headers["set-cookie"] === undefined &&
      Cookies.isEmpty(original.cookies) &&
      original.headers["content-range"] === undefined &&
      !hasWildcardVary(original.headers["vary"]) &&
      variesOnlyByAccept(original.headers["vary"]) &&
      responseContentMatches(original, representation);
    if (!cacheable) {
      return bypassResponse(original, options.buildId);
    }

    const response = HttpServerResponse.setHeaders(original, {
      ...headersFor("MISS"),
      ...diagnostics,
      vary: varyWithAccept(original.headers["vary"]),
    });
    const body = response.body;
    const maximum = options.maxBodyBytes ?? maxCachedBodyBytes;

    if (body._tag === "Uint8Array") {
      if (!renderFailed && body.body.length <= maximum) {
        yield* Effect.tryPromise(() =>
          cache.put(key, storedResponse(new Uint8Array(body.body).buffer, response)),
        ).pipe(Effect.catch(() => Effect.void));
      }
      return response;
    }

    if (body._tag !== "Stream") return response;

    const chunks: Array<Uint8Array> = [];
    let length = 0;
    let fits = true;
    const collect = (chunk: Uint8Array) =>
      Effect.sync(() => {
        if (!fits) return;
        length += chunk.length;
        if (length > maximum) {
          fits = false;
          chunks.length = 0;
          return;
        }
        chunks.push(chunk);
      });
    const put = Effect.suspend(() => {
      if (!fits || renderFailed) return Effect.void;
      return Effect.tryPromise(() =>
        cache.put(key, storedResponse(new Uint8Array(concat(chunks, length)).buffer, response)),
      ).pipe(Effect.catch(() => Effect.void));
    });
    const cachedStream = body.stream.pipe(
      Stream.tap(collect),
      Stream.concat(Stream.fromEffect(put).pipe(Stream.drain)),
    );
    return HttpServerResponse.setBody(
      response,
      HttpBody.stream(cachedStream, body.contentType, body.contentLength),
    );
  });
