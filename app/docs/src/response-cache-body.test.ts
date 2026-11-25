import { describe, expect, it } from "@effect/vitest";
import { Data, Effect, Stream } from "effect";
import { HttpServerResponse } from "effect/http";

import {
  htmlResponse,
  pageRequest,
  policy,
  publicPolicy,
  readText,
  runCached,
} from "./response-cache.fixture.ts";

const requestHeaders = ["cookie", "authorization"].flatMap((header) =>
  ["one", "two", ""].map((value) => ({ header, value })),
);

describe("cache response headers", () => {
  it.effect.each(requestHeaders)(
    "uses the public docs policy with request $header set to $value",
    ({ header, value }) =>
      Effect.gen(function* () {
        const response = yield* runCached(pageRequest({ [header]: value }));
        expect(policy(response)).toStrictEqual(publicPolicy);
        expect(response.headers["vary"]).toBe("accept");
      }),
  );

  it.effect("preserves Set-Cookie without changing the public policy", () =>
    Effect.gen(function* () {
      const original = HttpServerResponse.setHeader(
        htmlResponse(),
        "set-cookie",
        "session=private",
      );
      const response = yield* runCached(pageRequest(), Effect.succeed(original));
      expect(policy(response)).toStrictEqual(publicPolicy);
      expect(response.headers["set-cookie"]).toBe("session=private");
    }),
  );

  it.effect("preserves native Effect cookies without changing the public policy", () =>
    Effect.gen(function* () {
      const original = HttpServerResponse.setCookieUnsafe(htmlResponse(), "session", "private");
      const response = yield* runCached(pageRequest(), Effect.succeed(original));
      expect(policy(response)).toStrictEqual(publicPolicy);
      expect(response.cookies).toBe(original.cookies);
      expect(HttpServerResponse.toWeb(response).headers.get("set-cookie")).toContain(
        "session=private",
      );
    }),
  );

  it.effect("preserves and deduplicates existing Vary dimensions", () =>
    Effect.gen(function* () {
      const original = HttpServerResponse.setHeader(
        htmlResponse(),
        "vary",
        "Accept-Language, ACCEPT",
      );
      const response = yield* runCached(pageRequest(), Effect.succeed(original));
      expect(policy(response)).toStrictEqual(publicPolicy);
      expect(response.headers["vary"]).toBe("accept-language, accept");
    }),
  );
});

class CacheFixtureFailure extends Data.TaggedError("CacheFixtureFailure")<{ message: string }> {}

describe("cache response body and failure", () => {
  it.effect("leaves a pending response stream untouched", () =>
    Effect.gen(function* () {
      const original = HttpServerResponse.stream(Stream.never, { contentType: "text/html" });
      const response = yield* runCached(pageRequest(), Effect.succeed(original));
      expect(policy(response)).toStrictEqual(publicPolicy);
      expect(response.body).toBe(original.body);
    }),
  );

  it.effect("preserves stream bytes", () =>
    Effect.gen(function* () {
      const encoder = new TextEncoder();
      const chunks = [encoder.encode("first"), encoder.encode("second")];
      const original = HttpServerResponse.stream(Stream.fromIterable(chunks), {
        contentType: "text/html",
      });
      const response = yield* runCached(pageRequest(), Effect.succeed(original));
      expect(response.body).toBe(original.body);
      const text = yield* Effect.promise(async () => readText(response));
      expect(text).toBe("firstsecond");
    }),
  );

  it.effect("preserves stream failures", () =>
    Effect.gen(function* () {
      const failure = new CacheFixtureFailure({ message: "render failed" });
      const original = HttpServerResponse.stream(Stream.fail(failure), {
        contentType: "text/html",
      });
      const response = yield* runCached(pageRequest(), Effect.succeed(original));
      expect(response.body).toBe(original.body);
      yield* Effect.promise(async () => {
        await expect(readText(response)).rejects.toThrow("render failed");
      });
    }),
  );

  it.effect("propagates handler failures", () =>
    Effect.gen(function* () {
      const original = new CacheFixtureFailure({ message: "handler failed" });
      const failure = yield* Effect.flip(runCached(pageRequest(), Effect.fail(original)));
      expect(failure).toBe(original);
    }),
  );
});
