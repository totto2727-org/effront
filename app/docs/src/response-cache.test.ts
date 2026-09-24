import { Effect, Stream } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { describe, expect, it } from "vite-plus/test";
import { RenderErrorObserver } from "@effront/core/http";

import { withResponseCache } from "./response-cache";

class MemoryCache {
  readonly entries = new Map<string, Response>();
  readonly keys: Array<string> = [];

  match = async (request: Request) => this.entries.get(request.url)?.clone();
  put = async (request: Request, response: Response) => {
    this.keys.push(request.url);
    this.entries.set(request.url, response.clone());
  };
}

const run = async (
  request: Request,
  cache: MemoryCache,
  options: {
    readonly buildId?: string;
    readonly development?: boolean;
    readonly maxBodyBytes?: number;
  } = {},
  app = Effect.succeed(HttpServerResponse.text("rendered", { contentType: "text/html" })),
) =>
  Effect.runPromise(
    withResponseCache(app, {
      buildId: options.buildId ?? "build-a",
      cache,
      development: options.development,
      maxBodyBytes: options.maxBodyBytes,
    }).pipe(
      Effect.provideService(
        HttpServerRequest.HttpServerRequest,
        HttpServerRequest.fromWeb(request),
      ),
    ),
  );

const web = (response: HttpServerResponse.HttpServerResponse) => HttpServerResponse.toWeb(response);

describe("docs response cache", () => {
  it("keeps origin, path, search, and build identifier in actual cache keys", async () => {
    const cache = new MemoryCache();
    await run(new Request("https://docs.example/guide?a=1"), cache);
    await run(new Request("https://other.example/guide?a=1"), cache, { buildId: "build-b" });
    expect(cache.keys).toEqual([
      "https://docs.example/__effront-response-cache/build-a/html/guide?a=1",
      "https://other.example/__effront-response-cache/build-b/html/guide?a=1",
    ]);
  });

  it("stores a successful GET once and serves the second request as a hit", async () => {
    const cache = new MemoryCache();
    const request = new Request("https://docs.example/guide?tab=api");

    const miss = web(await run(request, cache));
    expect(miss.headers.get("x-effront-cache")).toBe("MISS");
    expect(miss.headers.get("x-effront-build-id")).toBe("build-a");
    expect(miss.headers.get("cache-control")).toContain("max-age=0");
    expect(miss.headers.get("cache-control")).not.toContain("s-maxage");
    expect(await miss.text()).toBe("rendered");

    const hit = web(await run(request, cache, {}, Effect.die("must not render")));
    expect(hit.headers.get("x-effront-cache")).toBe("HIT");
    expect(await hit.text()).toBe("rendered");
  });

  it("rejects missing or stale Flight build IDs before cache lookup", async () => {
    const cache = new MemoryCache();
    const response = web(
      await run(
        new Request("https://docs.example/guide", { headers: { accept: "text/x-component" } }),
        cache,
      ),
    );

    expect(response.status).toBe(409);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-effront-cache")).toBe("BYPASS");
    expect(cache.keys).toEqual([]);
  });

  it("does not cache unsafe requests or responses", async () => {
    const cache = new MemoryCache();
    const request = new Request("https://docs.example/guide", {
      headers: { cookie: "session=secret" },
    });
    const response = web(await run(request, cache));
    expect(response.headers.get("x-effront-cache")).toBe("BYPASS");
    expect(cache.keys).toEqual([]);

    const error = web(
      await run(
        new Request("https://docs.example/missing"),
        cache,
        {},
        Effect.succeed(HttpServerResponse.text("missing", { status: 404 })),
      ),
    );
    expect(error.headers.get("x-effront-cache")).toBe("BYPASS");
    expect(error.headers.get("cache-control")).toBe("private, no-store");
    expect(cache.keys).toEqual([]);

    const redirect = web(
      await run(
        new Request("https://docs.example/retired"),
        cache,
        {},
        Effect.succeed(HttpServerResponse.redirect("/current", { status: 308 })),
      ),
    );
    expect(redirect.headers.get("x-effront-cache")).toBe("BYPASS");
    expect(redirect.headers.get("cache-control")).toBe("private, no-store");

    const cookie = web(
      await run(
        new Request("https://docs.example/personal"),
        cache,
        {},
        Effect.succeed(
          HttpServerResponse.text("personal", {
            contentType: "text/html",
            headers: { "set-cookie": "session=private", "cache-control": "public, max-age=600" },
          }),
        ),
      ),
    );
    expect(cookie.headers.get("x-effront-cache")).toBe("BYPASS");
    expect(cookie.headers.get("cache-control")).toBe("private, no-store");

    const localized = web(
      await run(
        new Request("https://docs.example/localized"),
        cache,
        {},
        Effect.succeed(
          HttpServerResponse.text("localized", {
            contentType: "text/html",
            headers: { vary: "Accept-Language" },
          }),
        ),
      ),
    );
    expect(localized.headers.get("x-effront-cache")).toBe("BYPASS");
    expect(localized.headers.get("cache-control")).toBe("private, no-store");
  });

  it("fails open when Cloudflare Cache API reads or writes reject", async () => {
    const matchFailure = new MemoryCache();
    matchFailure.match = async () => Promise.reject(new Error("cache unavailable"));
    const fromMiss = web(
      await run(new Request("https://docs.example/match-failure"), matchFailure),
    );
    expect(fromMiss.headers.get("x-effront-cache")).toBe("MISS");
    expect(await fromMiss.text()).toBe("rendered");

    const putFailure = new MemoryCache();
    putFailure.put = async () => Promise.reject(new Error("cache unavailable"));
    const fromPut = web(await run(new Request("https://docs.example/put-failure"), putFailure));
    expect(fromPut.headers.get("x-effront-cache")).toBe("MISS");
    expect(await fromPut.text()).toBe("rendered");
  });

  it("fills only after a streamed response reaches EOF", async () => {
    const cache = new MemoryCache();
    const request = new Request("https://origin.example/stream?variant=eof");
    const app = Effect.succeed(
      HttpServerResponse.stream(Stream.fromIterable([new TextEncoder().encode("streamed")]), {
        contentType: "text/html",
      }),
    );

    const miss = web(await run(request, cache, {}, app));
    expect(await miss.text()).toBe("streamed");
    expect(cache.keys).toEqual([
      "https://origin.example/__effront-response-cache/build-a/html/stream?variant=eof",
    ]);

    const hit = web(await run(request, cache, {}, Effect.die("must not render")));
    expect(hit.headers.get("x-effront-cache")).toBe("HIT");
    expect(await hit.text()).toBe("streamed");
  });

  it("does not cache a successful stream after React reports a deferred render error", async () => {
    const cache = new MemoryCache();
    const app = Effect.gen(function* () {
      const observe = yield* RenderErrorObserver;
      return HttpServerResponse.stream(
        Stream.fromEffect(
          Effect.sync(() => {
            observe?.();
            return new TextEncoder().encode("encoded error");
          }),
        ),
        { contentType: "text/html" },
      );
    });
    const response = web(
      await run(new Request("https://docs.example/render-error"), cache, {}, app),
    );
    expect(await response.text()).toBe("encoded error");
    expect(cache.keys).toEqual([]);
  });

  it("does not fill when a streamed response fails, cancels, or exceeds its bound", async () => {
    const failingCache = new MemoryCache();
    const failing = web(
      await run(
        new Request("https://docs.example/stream-failure"),
        failingCache,
        {},
        Effect.succeed(
          HttpServerResponse.stream(Stream.fail(new Error("render failed")), {
            contentType: "text/html",
          }),
        ),
      ),
    );
    await expect(failing.text()).rejects.toThrow("render failed");
    expect(failingCache.keys).toEqual([]);

    const cancelledCache = new MemoryCache();
    const cancelled = web(
      await run(
        new Request("https://docs.example/stream-cancel"),
        cancelledCache,
        {},
        Effect.succeed(HttpServerResponse.stream(Stream.never, { contentType: "text/html" })),
      ),
    );
    await cancelled.body!.cancel();
    expect(cancelledCache.keys).toEqual([]);

    const oversizedCache = new MemoryCache();
    const oversized = web(
      await run(
        new Request("https://docs.example/stream-large"),
        oversizedCache,
        { maxBodyBytes: 3 },
        Effect.succeed(
          HttpServerResponse.stream(Stream.succeed(new TextEncoder().encode("large")), {
            contentType: "text/html",
          }),
        ),
      ),
    );
    expect(await oversized.text()).toBe("large");
    expect(oversizedCache.keys).toEqual([]);
  });

  it("bypasses the Cache API during development and skips bodies above the bound", async () => {
    const cache = new MemoryCache();
    expect(
      web(
        await run(new Request("https://docs.example/guide"), cache, { development: true }),
      ).headers.get("x-effront-cache"),
    ).toBe("BYPASS");
    expect(cache.keys).toEqual([]);

    const large = Effect.succeed(
      HttpServerResponse.uint8Array(new Uint8Array(9), { contentType: "text/html" }),
    );
    expect(
      web(
        await run(new Request("https://docs.example/large"), cache, { maxBodyBytes: 8 }, large),
      ).headers.get("x-effront-cache"),
    ).toBe("MISS");
    expect(cache.keys).toEqual([]);
  });
});
