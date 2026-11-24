import { NodeHttpServer } from "@effect/platform-node";
import { live } from "@effect/vitest";
import { Context, Deferred, Effect, Result } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { describe, expect } from "vitest";

import {
  applicationStatus,
  assetFiles,
  cancelDownload,
  fileBody,
  rawGet,
  requestAsset,
  standardAssetServer,
  startAssetServer,
} from "./assets.fixture.ts";
import { withAssets } from "./assets.ts";

const ok = 200;
const notFound = 404;
const internalServerError = 500;
const largeFileBytes = 67_108_864;

describe("static asset fallthrough", () => {
  live.each([
    "/",
    "/docs",
    "/docs/",
    "/missing",
    "/assets-other/app-a1b2.js",
    "/_effront/protocol",
  ])("leaves %s to the application", (path) =>
    Effect.gen(function* () {
      const { origin } = yield* standardAssetServer;
      const response = yield* requestAsset(`${origin}${path}`);
      expect([response.status, yield* response.text]).toStrictEqual([
        applicationStatus,
        "application",
      ]);
    }),
  );

  live.each([
    { method: "POST" },
    { headers: { accept: "text/x-component" } },
    { headers: { "x-effront-server-fn": "server-function" } },
  ] as const)("leaves application methods and protocol requests alone %j", (options) =>
    Effect.gen(function* () {
      const { origin } = yield* standardAssetServer;
      const response = yield* requestAsset(`${origin}/robots.txt`, options);
      expect([response.status, yield* response.text]).toStrictEqual([
        applicationStatus,
        "application",
      ]);
    }),
  );

  live.each(["/assets", "/assets/", "/assets/missing.js"])("serves a dedicated %s miss", (path) =>
    Effect.gen(function* () {
      const { origin } = yield* standardAssetServer;
      const response = yield* requestAsset(`${origin}${path}`);
      expect([response.status, yield* response.text]).toStrictEqual([notFound, ""]);
    }),
  );
});

describe("native static URL handling", () => {
  live.each([
    "/assets/../secret.txt",
    "/assets/%2e%2e/secret.txt",
    "/assets/%2e%2e%2fsecret.txt",
    "/assets/%00.txt",
    "/assets/%zz",
  ])("delegates rejection of %s to the standard server", (path) =>
    Effect.gen(function* () {
      const { opened, origin } = yield* standardAssetServer;
      const response = yield* rawGet(origin, path);
      expect(response).toStrictEqual({ body: "", status: notFound });
      expect(opened).toHaveLength(0);
    }),
  );

  live.each(["/assets/./app-a1b2.js", "/assets/sub/../app-a1b2.js"])(
    "delegates normalization of %s to the standard server",
    (path) =>
      Effect.gen(function* () {
        const { origin } = yield* standardAssetServer;
        expect(yield* rawGet(origin, path)).toStrictEqual({ body: fileBody, status: ok });
      }),
  );

  live("rewrites nested prefixes and encoded filenames exactly once", () =>
    Effect.gen(function* () {
      const { fs, options, path, root } = yield* assetFiles;
      const filename = "literal%2e%2e?# 日本語.txt";
      yield* fs.writeFileString(path.join(root, "client", filename), "encoded filename");
      const mount = { ...options, client: { ...options.client, prefix: "/nested/assets/" } };
      const { origin } = yield* startAssetServer(mount, {});
      const url = `${origin}/nested/assets/${encodeURIComponent(filename)}?version=1`;
      const response = yield* requestAsset(url);
      expect([response.status, yield* response.text]).toStrictEqual([ok, "encoded filename"]);
      const missing = yield* requestAsset(`${origin}/nested/assets/missing`);
      expect([missing.status, yield* missing.text]).toStrictEqual([notFound, ""]);
    }),
  );
});

describe("native filesystem and cancellation", () => {
  live("reports filesystem errors without falling through to the application", () =>
    Effect.gen(function* () {
      const { options, path, root } = yield* assetFiles;
      const deniedStatPath = path.join(root, "public", "robots.txt");
      const { opened, origin } = yield* startAssetServer(options, { deniedStatPath });
      const response = yield* requestAsset(`${origin}/robots.txt`);
      expect([response.status, yield* response.text]).toStrictEqual([internalServerError, ""]);
      expect(opened).toHaveLength(0);
    }),
  );

  live("defers missing root handling to the standard request-time lookup", () =>
    Effect.gen(function* () {
      const { options, path, root } = yield* assetFiles;
      const mounts = {
        client: { ...options.client, root: path.join(root, "missing-client") },
        public: { root: path.join(root, "missing-public") },
      };
      const { opened, origin } = yield* startAssetServer(mounts, {});
      const client = yield* requestAsset(`${origin}/assets/missing.txt`);
      expect([client.status, yield* client.text]).toStrictEqual([notFound, ""]);
      const publicFile = yield* requestAsset(`${origin}/missing.txt`);
      expect([publicFile.status, yield* publicFile.text]).toStrictEqual([
        applicationStatus,
        "application",
      ]);
      expect(opened).toHaveLength(0);
    }),
  );

  live("finalizes the filesystem stream when the native client cancels", () =>
    Effect.gen(function* () {
      const { fs, options, path, root } = yield* assetFiles;
      const file = path.join(root, "client", "large.bin");
      yield* fs.writeFileString(file, "");
      yield* fs.truncate(file, largeFileBytes);
      const closed = yield* Deferred.make<boolean>();
      const { opened, origin } = yield* startAssetServer(options, {
        onStreamExit: (completed) => Deferred.succeed(closed, completed).pipe(Effect.asVoid),
      });
      yield* cancelDownload(`${origin}/assets/large.bin`);
      expect(yield* Deferred.await(closed)).toBe(false);
      expect(opened).toStrictEqual([file]);
    }),
  );
});

class External extends Context.Service<External, string>()(
  "@effront/server/test/assets/External",
) {}

describe("native application capabilities in asset hosting", () => {
  live("preserves request services and typed application failure through the asset layer", () =>
    Effect.gen(function* () {
      const { options } = yield* assetFiles;
      const application = Effect.flatMap(External, (value) =>
        value === "fail"
          ? Effect.fail("application-error" as const)
          : Effect.succeed(HttpServerResponse.text(value)),
      );
      const handler = yield* withAssets(application, options).pipe(
        Effect.provide(NodeHttpServer.layerHttpServices),
      );
      const request = HttpServerRequest.fromWeb(new Request("http://localhost/missing"));
      const requestHandler = handler.pipe(
        Effect.provideService(HttpServerRequest.HttpServerRequest, request),
      );
      const response = yield* requestHandler.pipe(
        Effect.provideService(External, "request-service"),
      );
      const web = HttpServerResponse.toWeb(response);
      expect(yield* Effect.promise(async () => web.text())).toBe("request-service");
      const failure = yield* requestHandler.pipe(
        Effect.provideService(External, "fail"),
        Effect.result,
      );
      expect(Result.isFailure(failure) && failure.failure).toBe("application-error");
    }),
  );
});
