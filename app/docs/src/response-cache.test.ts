import { Effect, Stream } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { describe, expect, it } from "vite-plus/test";

import { responseCache } from "./response-cache";

const requiredVary = ["accept", "cookie", "authorization"];
const html = () =>
  HttpServerResponse.text("rendered", {
    contentType: "text/html",
    headers: { "cache-control": "private, no-store" },
  });
const run = <E>(
  request: Request,
  app: Effect.Effect<HttpServerResponse.HttpServerResponse, E> = Effect.succeed(html()),
  development = false,
) =>
  Effect.runPromise(
    app.pipe(
      responseCache({ development }),
      Effect.provideService(
        HttpServerRequest.HttpServerRequest,
        HttpServerRequest.fromWeb(request),
      ),
    ),
  );
const expectPolicy = (response: HttpServerResponse.HttpServerResponse, publicResponse: boolean) => {
  expect(response.headers["cache-control"]).toBe(
    publicResponse ? "public, max-age=0, must-revalidate" : "private, no-store",
  );
  expect(response.headers["cloudflare-cdn-cache-control"]).toBe(
    publicResponse ? "public, max-age=31536000" : "private, no-store",
  );
  expect(response.headers["vary"]?.split(", ")).toEqual(expect.arrayContaining(requiredVary));
  expect(response.headers["x-effront-cache"]).toBeUndefined();
};

describe("docs native cache header policy", () => {
  for (const accept of ["text/html", "text/x-component"]) {
    it(`opts public ${accept} into edge caching without changing the original response`, async () => {
      const original = HttpServerResponse.text("rendered", {
        contentType: `${accept}; charset=utf-8`,
        headers: { "cache-control": "private, no-store", "x-origin": "preserved" },
      });
      const response = await run(
        new Request("https://docs.example/guide", {
          headers: { accept },
        }),
        Effect.succeed(original),
      );
      expectPolicy(response, true);
      expect(response.body).toBe(original.body);
      expect(response.headers["x-origin"]).toBe("preserved");
      expect(original.headers["cache-control"]).toBe("private, no-store");
      expect(original.headers["cloudflare-cdn-cache-control"]).toBeUndefined();
      expect(await HttpServerResponse.toWeb(response).text()).toBe("rendered");
    });
  }

  it.each(["text/x-component, text/html", "text/x-component; charset=utf-8", "TEXT/X-COMPONENT"])(
    "uses HTML negotiation for non-exact Flight Accept %s",
    async (accept) => {
      const response = await run(
        new Request("https://docs.example/guide", { headers: { accept } }),
      );
      expect(response.status).toBe(200);
      expectPolicy(response, true);
    },
  );

  it("development disables both caches", async () => {
    const response = await run(
      new Request("https://docs.example/guide", { headers: { accept: "text/x-component" } }),
      Effect.succeed(HttpServerResponse.text("flight", { contentType: "text/x-component" })),
      true,
    );
    expect(response.status).toBe(200);
    expectPolicy(response, false);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE", "HEAD"])("disables storage for %s", async (method) => {
    expectPolicy(await run(new Request("https://docs.example/guide", { method })), false);
  });

  it.each([
    ["cookie", "session=private"],
    ["cookie", ""],
    ["authorization", "Bearer private"],
    ["range", "bytes=0-10"],
  ])("disables storage for request %s=%s", async (name, value) => {
    expectPolicy(
      await run(new Request("https://docs.example/guide", { headers: { [name]: value } })),
      false,
    );
  });

  it.each([204, 206, 301, 302, 304, 404, 500])(
    "disables storage for response status %s",
    async (status) => {
      const response = await run(
        new Request("https://docs.example/guide"),
        Effect.succeed(HttpServerResponse.text("not public", { status, contentType: "text/html" })),
      );
      expect(response.status).toBe(status);
      expectPolicy(response, false);
    },
  );

  it.each([
    ["set-cookie", "session=private"],
    ["content-range", "bytes 0-10/20"],
    ["vary", "Accept-Language, *"],
  ])("disables storage for response %s", async (name, value) => {
    expectPolicy(
      await run(
        new Request("https://docs.example/guide"),
        Effect.succeed(HttpServerResponse.setHeader(html(), name, value)),
      ),
      false,
    );
  });

  it("respects native Effect cookies and preserves their serialization", async () => {
    const original = HttpServerResponse.setCookieUnsafe(html(), "session", "private", {
      httpOnly: true,
    });
    const response = await run(new Request("https://docs.example/guide"), Effect.succeed(original));
    expectPolicy(response, false);
    expect(response.cookies).toBe(original.cookies);
    expect(HttpServerResponse.toWeb(response).headers.get("set-cookie")).toContain(
      "session=private",
    );
  });

  it("preserves other Vary dimensions while deduplicating required fields", async () => {
    const response = await run(
      new Request("https://docs.example/guide"),
      Effect.succeed(
        HttpServerResponse.setHeader(html(), "vary", "Accept-Language, ACCEPT, Cookie"),
      ),
    );
    expectPolicy(response, true);
    expect(response.headers["vary"]?.split(", ")).toEqual([
      "accept-language",
      "accept",
      "cookie",
      "authorization",
    ]);
  });

  it.each(["application/json", "text/plain", "text/html-other", "text/x-component"])(
    "does not opt unexpected HTML-request content type %s into caching",
    async (contentType) => {
      expectPolicy(
        await run(
          new Request("https://docs.example/guide"),
          Effect.succeed(HttpServerResponse.text("other", { contentType })),
        ),
        false,
      );
    },
  );

  it("does not cache HTML returned to a Flight request", async () => {
    expectPolicy(
      await run(
        new Request("https://docs.example/guide", {
          headers: { accept: "text/x-component" },
        }),
      ),
      false,
    );
  });

  it("leaves a pending body stream untouched instead of collecting it", async () => {
    const original = HttpServerResponse.stream(Stream.never, { contentType: "text/html" });
    const response = await run(
      new Request("https://docs.example/stream"),
      Effect.succeed(original),
    );
    expectPolicy(response, true);
    expect(response.body).toBe(original.body);
  });

  it("preserves stream bytes without wrapping the stream", async () => {
    const original = HttpServerResponse.stream(
      Stream.fromIterable([new TextEncoder().encode("first"), new TextEncoder().encode("second")]),
      { contentType: "text/html" },
    );
    const response = await run(
      new Request("https://docs.example/stream"),
      Effect.succeed(original),
    );
    expect(response.body).toBe(original.body);
    expect(await HttpServerResponse.toWeb(response).text()).toBe("firstsecond");
  });

  it("preserves streamed failures", async () => {
    const original = HttpServerResponse.stream(Stream.fail(new Error("render failed")), {
      contentType: "text/html",
    });
    const response = await run(
      new Request("https://docs.example/stream"),
      Effect.succeed(original),
    );
    expect(response.body).toBe(original.body);
    await expect(HttpServerResponse.toWeb(response).text()).rejects.toThrow("render failed");
  });

  it("propagates handler failures", async () => {
    await expect(
      run(new Request("https://docs.example/guide"), Effect.fail(new Error("handler failed"))),
    ).rejects.toThrow("handler failed");
  });
});
