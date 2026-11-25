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

const expectedPolicy = (eligible: boolean): typeof publicPolicy =>
  eligible ? publicPolicy : privatePolicy;

const flightAcceptCases = [
  { accept: "text/x-component", eligible: true },
  { accept: "text/x-component; charset=utf-8", eligible: false },
  { accept: "text/x-component;q=0", eligible: false },
  { accept: "*/*", eligible: true },
  { accept: "text/*", eligible: true },
  { accept: "text/html, text/x-component", eligible: true },
  { accept: "text/x-component;q=0, */*", eligible: false },
  { accept: "text/x-component;q=0.5, */*;q=0", eligible: true },
  { accept: "TEXT/X-COMPONENT;q=0.5", eligible: true },
  { accept: "text/x-component;q=0, text/*", eligible: false },
  { accept: "text/html, */*", eligible: true },
  { accept: "text/html", eligible: false },
] as const;

const representations = ["text/html", "text/x-component"] as const;

const symmetricCases = representations.flatMap((contentType) => [
  { accept: "*/*", contentType, eligible: true },
  { accept: "text/*", contentType, eligible: true },
  { accept: `${contentType};q=0, */*`, contentType, eligible: false },
  { accept: "text/*;q=0, */*", contentType, eligible: false },
  { accept: "*/*;q=0", contentType, eligible: false },
  {
    accept: contentType === "text/html" ? "text/x-component" : "text/html",
    contentType,
    eligible: false,
  },
]);

describe("cache eligibility from HTML and Flight negotiation", () => {
  it.effect.each(flightAcceptCases)(
    "checks Flight media type for Accept $accept",
    ({ accept, eligible }) =>
      Effect.gen(function* () {
        const original = HttpServerResponse.text("flight", { contentType: "text/x-component" });
        const response = yield* runCached(pageRequest({ accept }), Effect.succeed(original));
        expect(policy(response)).toStrictEqual(expectedPolicy(eligible));
        expect(response.body).toBe(original.body);
      }),
  );

  it.effect.each(symmetricCases)(
    "applies symmetric policy to $contentType with Accept $accept",
    ({ accept, contentType, eligible }) =>
      Effect.gen(function* () {
        const original = HttpServerResponse.text("rendered", {
          contentType,
          headers: { vary: "Accept-Language, ACCEPT" },
        });
        const response = yield* runCached(pageRequest({ accept }), Effect.succeed(original));
        expect(policy(response)).toStrictEqual(expectedPolicy(eligible));
        expect(response.body).toBe(original.body);
        expect(response.headers["content-type"]).toBe(original.headers["content-type"]);
        expect(response.headers["vary"]).toBe("accept-language, accept");
        const text = yield* Effect.promise(async () => readText(response));
        expect(text).toBe("rendered");
      }),
  );
});

describe("actual response media type", () => {
  it.effect.each(["application/json", "text/html-extra", "application/xhtml+xml"])(
    "does not cache response type %s for a wildcard request",
    (contentType) =>
      Effect.gen(function* () {
        const original = HttpServerResponse.text("not HTML", { contentType });
        const response = yield* runCached(pageRequest({ accept: "*/*" }), Effect.succeed(original));
        expect(policy(response)).toStrictEqual(privatePolicy);
      }),
  );

  it.effect("does not cache a response without a media type", () =>
    Effect.gen(function* () {
      const response = yield* runCached(
        pageRequest({ accept: "*/*" }),
        Effect.succeed(HttpServerResponse.empty()),
      );
      expect(policy(response)).toStrictEqual(privatePolicy);
    }),
  );

  it.effect("recognizes HTML response media types with parameters and mixed case", () =>
    Effect.gen(function* () {
      const original = HttpServerResponse.setHeader(
        htmlResponse(),
        "content-type",
        "Text/HTML; charset=utf-8",
      );
      const response = yield* runCached(pageRequest({ accept: "*/*" }), Effect.succeed(original));
      expect(policy(response)).toStrictEqual(publicPolicy);
      expect(response.headers["content-type"]).toBe(original.headers["content-type"]);
      expect(response.body).toBe(original.body);
    }),
  );
});

describe("actual response media type parameters", () => {
  it.effect.each(representations)(
    "matches Accept parameters against the actual %s response",
    (mediaType) =>
      Effect.gen(function* () {
        const contentType = `${mediaType}; charset=utf-8`;
        const original = HttpServerResponse.setHeader(
          HttpServerResponse.text("rendered"),
          "content-type",
          contentType,
        );
        const matchingRequest = pageRequest({ accept: contentType });
        const incompatibleRequest = pageRequest({ accept: `${mediaType}; charset=shift_jis` });
        const matching = yield* runCached(matchingRequest, Effect.succeed(original));
        const incompatible = yield* runCached(incompatibleRequest, Effect.succeed(original));
        expect(policy(matching)).toStrictEqual(publicPolicy);
        expect(policy(incompatible)).toStrictEqual(privatePolicy);
      }),
  );
});
