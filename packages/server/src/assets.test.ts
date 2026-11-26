import { live } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";

import { fileBody, immutableCache, requestAsset, standardAssetServer } from "./assets.fixture.ts";

const ok = 200;
const partialContent = 206;
const notModified = 304;
const rangeNotSatisfiable = 416;
const assetPath = "/assets/app-a1b2.js";
const fileLength = String(fileBody.length);

describe("native static asset content", () => {
  live("serves client bytes, JavaScript MIME type and immutable cache policy", () =>
    Effect.gen(function* () {
      const { origin } = yield* standardAssetServer;
      const response = yield* requestAsset(`${origin}${assetPath}?version=1`);
      expect(response.status).toBe(ok);
      expect(response.headers).toMatchObject({
        "cache-control": immutableCache,
        "content-length": fileLength,
        "content-type": "text/javascript; charset=utf-8",
      });
      expect(yield* response.text).toBe(fileBody);
    }),
  );

  live("uses revalidation and appropriate MIME types for public files", () =>
    Effect.gen(function* () {
      const { origin } = yield* standardAssetServer;
      const publicFile = yield* requestAsset(`${origin}/icon.svg`);
      expect(publicFile.headers).toMatchObject({
        "cache-control": "public, max-age=0, must-revalidate",
        "content-type": "image/svg+xml; charset=utf-8",
      });
      expect(yield* publicFile.text).toBe("<svg/>");
      const unknown = yield* requestAsset(`${origin}/unknown.extension`);
      expect(unknown.headers["content-type"]).toBe("application/octet-stream");
      expect(yield* unknown.text).toBe("unknown");
    }),
  );

  live("serves empty files and rejects their byte ranges without opening a second stream", () =>
    Effect.gen(function* () {
      const { opened, origin } = yield* standardAssetServer;
      const url = `${origin}/assets/empty.txt`;
      const response = yield* requestAsset(url);
      expect([response.status, yield* response.text]).toStrictEqual([ok, ""]);
      const range = yield* requestAsset(url, { headers: { range: "bytes=0-" } });
      expect([range.status, range.headers["content-range"], yield* range.text]).toStrictEqual([
        rangeNotSatisfiable,
        "bytes */0",
        "",
      ]);
      expect(opened).toHaveLength(1);
    }),
  );
});

const headAsset = (url: string): ReturnType<typeof requestAsset> =>
  requestAsset(url, { method: "HEAD" });

describe("static conditional requests", () => {
  live("answers HEAD without opening a file stream", () =>
    Effect.gen(function* () {
      const { opened, origin } = yield* standardAssetServer;
      const url = `${origin}${assetPath}`;
      const head = yield* headAsset(url);
      expect([head.status, head.headers["content-length"], yield* head.text]).toStrictEqual([
        ok,
        fileLength,
        "",
      ]);
      expect(head.headers).not.toHaveProperty("content-range");
      expect(opened).toHaveLength(0);
    }),
  );

  live.each([
    { etagCondition: "match" },
    { etagCondition: "list" },
    { etagCondition: "any" },
    { etagCondition: "range" },
    { etagCondition: "modified" },
  ] as const)(
    "answers the $etagCondition validator without opening a stream",
    ({ etagCondition }) =>
      Effect.gen(function* () {
        const { opened, origin } = yield* standardAssetServer;
        const url = `${origin}${assetPath}`;
        const head = yield* headAsset(url);
        const etag = head.headers["etag"] ?? "";
        const modified = head.headers["last-modified"] ?? "";
        const headers = {
          any: { "if-none-match": "*" },
          list: { "if-none-match": `"other", ${etag}` },
          match: { "if-none-match": etag },
          modified: { "if-modified-since": modified },
          range: { "if-none-match": etag, range: "bytes=1-3" },
        }[etagCondition];
        const response = yield* requestAsset(url, { headers });
        expect([etag, modified]).not.toContain("");
        expect([
          response.status,
          response.headers["etag"],
          response.headers["cache-control"],
          yield* response.text,
          opened,
        ]).toStrictEqual([notModified, etag, head.headers["cache-control"], "", []]);
      }),
  );
});

describe("static conditional request priority", () => {
  live("gives a nonmatching If-None-Match precedence over the modification date", () =>
    Effect.gen(function* () {
      const { opened, origin } = yield* standardAssetServer;
      const url = `${origin}${assetPath}`;
      const head = yield* headAsset(url);
      const response = yield* requestAsset(url, {
        headers: {
          "if-modified-since": head.headers["last-modified"] ?? "",
          "if-none-match": '"different"',
        },
      });
      expect([response.status, response.headers["etag"], yield* response.text]).toStrictEqual([
        ok,
        head.headers["etag"],
        fileBody,
      ]);
      expect(opened).toHaveLength(1);
    }),
  );
});

describe("static byte range responses", () => {
  live.each([
    { body: "234", contentRange: "bytes 2-4/10", range: "bytes=2-4" },
    { body: "89", contentRange: "bytes 8-9/10", range: "bytes=8-" },
    { body: "789", contentRange: "bytes 7-9/10", range: "bytes=-3" },
    { body: "89", contentRange: "bytes 8-9/10", range: "bytes=8-999" },
    { body: fileBody, contentRange: "bytes 0-9/10", range: "bytes=-999" },
    { body: "89", contentRange: "bytes 8-9/10", range: "bytes=8-999999999999999999999" },
  ])("serves a single byte range $range", ({ body, contentRange, range }) =>
    Effect.gen(function* () {
      const { opened, origin } = yield* standardAssetServer;
      const response = yield* requestAsset(`${origin}${assetPath}`, { headers: { range } });
      expect(response.status).toBe(partialContent);
      expect(response.headers).toMatchObject({
        "content-length": String(body.length),
        "content-range": contentRange,
      });
      expect(yield* response.text).toBe(body);
      expect(opened).toHaveLength(1);
    }),
  );

  live.each(["bytes=10-", "bytes=9-2", "bytes=-0", "bytes=999999999999999999999-"])(
    "rejects an unsatisfiable range %s without acquiring a stream",
    (range) =>
      Effect.gen(function* () {
        const { opened, origin } = yield* standardAssetServer;
        const response = yield* requestAsset(`${origin}${assetPath}`, { headers: { range } });
        expect([
          response.status,
          response.headers["content-range"],
          yield* response.text,
        ]).toStrictEqual([rangeNotSatisfiable, "bytes */10", ""]);
        expect(response.headers).not.toHaveProperty("cache-control");
        expect(response.headers).not.toHaveProperty("etag");
        expect(opened).toHaveLength(0);
      }),
  );
});

describe("static range fallback behavior", () => {
  live.each(["bytes=0-1,4-5", "items=0-1", "bytes=wat", "bytes=-"])(
    "ignores an unsupported or malformed range %s",
    (range) =>
      Effect.gen(function* () {
        const { origin } = yield* standardAssetServer;
        const response = yield* requestAsset(`${origin}${assetPath}`, { headers: { range } });
        expect([response.status, yield* response.text]).toStrictEqual([ok, fileBody]);
      }),
  );

  live.each(["bytes=2-3", "bytes=10-"])(
    "ignores range %s on HEAD without opening a file",
    (range) =>
      Effect.gen(function* () {
        const { opened, origin } = yield* standardAssetServer;
        const response = yield* requestAsset(`${origin}${assetPath}`, {
          headers: { range },
          method: "HEAD",
        });
        expect([
          response.status,
          response.headers["content-length"],
          yield* response.text,
        ]).toStrictEqual([ok, fileLength, ""]);
        expect(response.headers).not.toHaveProperty("content-range");
        expect(opened).toHaveLength(0);
      }),
  );
});

describe("static If-Range validators", () => {
  live("serves the complete file for each nonmatching If-Range validator", () =>
    Effect.gen(function* () {
      const { opened, origin } = yield* standardAssetServer;
      const url = `${origin}${assetPath}`;
      const head = yield* headAsset(url);
      const values = ['"stale"', head.headers["etag"] ?? "", head.headers["last-modified"] ?? ""];
      expect(values).not.toContain("");
      const replies = yield* Effect.forEach(values, (ifRange) =>
        Effect.gen(function* () {
          const response = yield* requestAsset(url, {
            headers: { "if-none-match": '"stale"', "if-range": ifRange, range: "bytes=1-2" },
          });
          return [
            response.status,
            response.headers["content-range"],
            response.headers["content-length"],
            yield* response.text,
          ];
        }),
      );
      const expected = [ok, undefined, fileLength, fileBody];
      expect(replies).toStrictEqual(values.map(() => expected));
      expect(opened).toHaveLength(values.length);
    }),
  );
});
