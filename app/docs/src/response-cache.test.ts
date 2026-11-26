import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { HttpServerResponse } from "effect/http";

import {
  htmlResponse,
  pageRequest,
  policy,
  privatePolicy,
  publicPolicy,
  readText,
  runCached,
} from "./response-cache.fixture.ts";

const publicAcceptHeaders = [
  "text/html",
  "text/*",
  "*/*",
  "*/*;q=0.8",
  "text/*;q=0.5, */*",
  "TEXT/HTML",
  "text/html;q=0.5, */*;q=0",
  "text/html, text/*;q=0",
  "text/html ; q = 0.5",
  "text/html,application/xhtml+xml,*/*;q=0.8",
];
const unsupportedAcceptHeaders = [
  "application/json",
  "",
  "text/x-component",
  "text/html-extra",
  "application/example;note=text/html",
  "text/html;q=invalid, */*",
  "text/html;q = 0, */*",
  "*/*;q=invalid",
  "*/*;q=0",
  "text/html;q=0, */*",
  "*/*, text/html;q=0",
  "text/*;q=0, */*",
  "text/html;q=0.0",
  "text/html;q=bogus",
  "text/html;q=-1",
  "text/html;q = 0",
  "text/html;q=0=1",
];
const negotiatedQualityHeaders = [
  "text/html;q=1.1, */*",
  "text/html;q=2",
  "text/html;q=0.0001",
  "text/html;q=1;q=0",
  "text/html;q=1;q=0, */*",
  "text/html;q",
  "text/html;q, */*",
  "text/html;q=1=0, */*",
  "text/html, text/html;q=0",
  "text/html;q=0, text/html",
];

describe("accept negotiation for HTML", () => {
  it.effect.each(publicAcceptHeaders)(
    "caches public GET with Accept %s without changing its body",
    (accept) =>
      Effect.gen(function* () {
        const original = htmlResponse();
        const response = yield* runCached(pageRequest({ accept }), Effect.succeed(original));
        expect(policy(response)).toStrictEqual(publicPolicy);
        expect(response.body).toBe(original.body);
        expect(original.headers["cache-control"]).toBe("private, no-store");
        const text = yield* Effect.promise(async () => readText(response));
        expect(text).toBe("rendered");
      }),
  );

  it.effect.each(unsupportedAcceptHeaders)(
    "does not opt unsupported Accept %s into caching",
    (accept) =>
      Effect.gen(function* () {
        const response = yield* runCached(pageRequest({ accept }));
        expect(policy(response)).toStrictEqual(privatePolicy);
      }),
  );

  it.effect("does not opt requests without Accept into caching", () =>
    Effect.gen(function* () {
      const response = yield* runCached(new Request("https://docs.example/guide"));
      expect(policy(response)).toStrictEqual(privatePolicy);
    }),
  );
});

describe("cache eligibility from Negotiator quality", () => {
  it.effect.each(negotiatedQualityHeaders)(
    "uses positive quality and duplicate semantics for %s",
    (accept) =>
      Effect.gen(function* () {
        const response = yield* runCached(pageRequest({ accept }));
        expect(policy(response)).toStrictEqual(publicPolicy);
      }),
  );

  it.effect("uses combined duplicate Accept header values", () =>
    Effect.gen(function* () {
      const request = pageRequest({ accept: "text/html;q=0" });
      request.headers.append("accept", "text/html");
      const response = yield* runCached(request);
      expect(policy(response)).toStrictEqual(publicPolicy);
    }),
  );
});

const nonGetCases = ["POST", "PUT", "PATCH", "DELETE", "HEAD"].flatMap((method) => [
  { accept: "text/html", method },
  { accept: "*/*", method },
]);

describe("request and response cache eligibility", () => {
  it.effect.each(nonGetCases)("does not cache $method with Accept $accept", ({ accept, method }) =>
    Effect.gen(function* () {
      const response = yield* runCached(pageRequest({ accept }, method));
      expect(policy(response)).toStrictEqual(privatePolicy);
    }),
  );

  it.effect.each([204, 206, 301, 302, 304, 404, 500])("does not cache status %s", (status) =>
    Effect.gen(function* () {
      const original = HttpServerResponse.setHeader(
        HttpServerResponse.empty({ status }),
        "content-type",
        "text/html",
      );
      const response = yield* runCached(pageRequest({ accept: "*/*" }), Effect.succeed(original));
      expect(response.status).toBe(status);
      expect(policy(response)).toStrictEqual(privatePolicy);
    }),
  );
});
