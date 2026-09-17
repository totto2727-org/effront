import { mkdir, mkdtemp, rm, symlink, truncate, writeFile } from "node:fs/promises";
import { createServer, request as nodeRequest } from "node:http";
import { join } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { Context, Effect, FileSystem, Result } from "effect";
import { systemError } from "effect/PlatformError";
import {
  Etag,
  HttpPlatform,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type AssetOptions, withAssets } from "./assets";

const temporaryRoot = fileURLToPath(new URL("../../../tmp/", import.meta.url));
let root: string;
let options: AssetOptions;

beforeEach(async () => {
  await mkdir(temporaryRoot, { recursive: true });
  root = await mkdtemp(join(temporaryRoot, "server-assets-"));
  await mkdir(join(root, "client"));
  await mkdir(join(root, "public"));
  await mkdir(join(root, "public", "docs"));
  await mkdir(join(root, "public", "_effront"));
  await writeFile(join(root, "client", "app-a1b2.js"), "0123456789");
  await writeFile(join(root, "client", "empty.txt"), "");
  await writeFile(join(root, "public", "robots.txt"), "public content");
  await writeFile(join(root, "public", "icon.svg"), "<svg/>");
  await writeFile(join(root, "public", "unknown.extension"), "unknown");
  await writeFile(join(root, "public", "index.html"), "not an SPA");
  await writeFile(join(root, "public", "docs", "index.html"), "not a directory index");
  await writeFile(join(root, "public", "_effront", "protocol"), "not a protocol response");
  await writeFile(join(root, "secret.txt"), "outside secret");
  await symlink(join(root, "secret.txt"), join(root, "public", "escape.txt"));
  await symlink(join(root, "secret.txt"), join(root, "client", "escape.txt"));
  await symlink(join(root, "public", "robots.txt"), join(root, "public", "inside.txt"));
  await symlink(join(root, "public"), join(root, "client", "outside-directory"));
  options = {
    client: {
      root: join(root, "client"),
      prefix: "/assets",
      cacheControl: "public, max-age=31536000, immutable",
    },
    public: { root: join(root, "public") },
  };
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const app = Effect.succeed(HttpServerResponse.text("application", { status: 202 }));

const withServer = (
  run: (origin: string, opened: string[]) => Promise<void>,
  settings: {
    readonly strongEtags?: boolean;
    readonly deniedPath?: string;
    readonly onFileResponse?: (response: HttpServerResponse.HttpServerResponse) => void;
  } = {},
) =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const platform = yield* HttpPlatform.HttpPlatform;
        const fs = yield* FileSystem.FileSystem;
        const opened: string[] = [];
        let construction = withAssets(app, options).pipe(
          Effect.provideService(HttpPlatform.HttpPlatform, {
            ...platform,
            fileResponse: (file, fileOptions) => {
              opened.push(file);
              return platform
                .fileResponse(file, fileOptions)
                .pipe(
                  Effect.tap((response) => Effect.sync(() => settings.onFileResponse?.(response))),
                );
            },
          }),
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            realPath: (file) =>
              file === settings.deniedPath
                ? Effect.fail(
                    systemError({
                      _tag: "PermissionDenied",
                      module: "FileSystem",
                      method: "realPath",
                    }),
                  )
                : fs.realPath(file),
          }),
        );
        if (settings.strongEtags) construction = construction.pipe(Effect.provide(Etag.layer));
        const handler = yield* construction;
        yield* HttpServer.serveEffect(handler);
        const origin = yield* HttpServer.addressFormattedWith(Effect.succeed);
        yield* Effect.promise(() => run(origin, opened));
      }),
    ).pipe(Effect.provide(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 }))),
  );

// Fetch normalizes dot segments, so traversal checks use the actual raw HTTP request target.
const rawGet = (origin: string, path: string): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    const request = nodeRequest(`${origin}/`, { path, agent: false }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => {
        body += chunk;
      });
      response.on("end", () => resolve({ status: response.statusCode ?? 0, body }));
      response.on("error", reject);
    });
    request.on("error", reject);
    request.end();
  });

describe("native static assets", () => {
  it("serves client/public bytes, MIME and distinct cache policies", () =>
    withServer(async (origin) => {
      const client = await fetch(`${origin}/assets/app-a1b2.js?version=1`);
      expect(client.status).toBe(200);
      expect(client.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
      expect(client.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
      expect(client.headers.get("content-length")).toBe("10");
      expect(await client.text()).toBe("0123456789");
      const publicFile = await fetch(`${origin}/icon.svg`);
      expect(publicFile.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
      expect(publicFile.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
      expect(await publicFile.text()).toBe("<svg/>");
      const unknown = await fetch(`${origin}/unknown.extension`);
      expect(unknown.headers.get("content-type")).toBe("application/octet-stream");
      expect(await unknown.text()).toBe("unknown");
    }));

  it("uses metadata only for HEAD and conditional responses, with stable validators", () =>
    withServer(async (origin, opened) => {
      const url = `${origin}/assets/app-a1b2.js`;
      const head = await fetch(url, { method: "HEAD", headers: { range: "bytes=2-3" } });
      expect(head.status).toBe(200);
      expect(head.headers.get("content-length")).toBe("10");
      expect(head.headers.get("content-range")).toBeNull();
      expect(await head.text()).toBe("");
      expect(opened).toHaveLength(0);
      const etag = head.headers.get("etag") ?? "";
      const modified = head.headers.get("last-modified") ?? "";
      expect(etag).not.toBe("");
      expect(modified).not.toBe("");
      for (const headers of [
        { "if-none-match": etag },
        { "if-none-match": '"other", ' + etag },
        { "if-none-match": "*" },
        { "if-modified-since": modified },
        { "if-none-match": etag, range: "bytes=1-3" },
      ]) {
        const response = await fetch(url, { headers });
        expect(response.status).toBe(304);
        expect(response.headers.get("etag")).toBe(etag);
        expect(response.headers.get("cache-control")).toBe(head.headers.get("cache-control"));
        expect(await response.text()).toBe("");
      }
      expect(opened).toHaveLength(0);
      const response = await fetch(url, {
        headers: { "if-none-match": '"different"', "if-modified-since": modified },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("etag")).toBe(etag);
      expect(await response.text()).toBe("0123456789");
      expect(opened).toHaveLength(1);
    }));

  it.each([
    ["bytes=2-4", "234", "bytes 2-4/10"],
    ["bytes=8-", "89", "bytes 8-9/10"],
    ["bytes=-3", "789", "bytes 7-9/10"],
    ["bytes=8-999999999999999999999", "89", "bytes 8-9/10"],
    ["bytes=-999", "0123456789", "bytes 0-9/10"],
  ])("serves a single range %s", (range, body, contentRange) =>
    withServer(async (origin, opened) => {
      const response = await fetch(`${origin}/assets/app-a1b2.js`, { headers: { range } });
      expect(response.status).toBe(206);
      expect(response.headers.get("content-range")).toBe(contentRange);
      expect(response.headers.get("content-length")).toBe(String(body.length));
      expect(await response.text()).toBe(body);
      expect(opened).toHaveLength(1);
    }),
  );

  it.each(["bytes=10-", "bytes=9-2", "bytes=-0", "bytes=999999999999999999999-"])(
    "rejects unsatisfiable %s without opening a body",
    (range) =>
      withServer(async (origin, opened) => {
        const response = await fetch(`${origin}/assets/app-a1b2.js`, { headers: { range } });
        expect(response.status).toBe(416);
        expect(response.headers.get("content-range")).toBe("bytes */10");
        expect(await response.text()).toBe("");
        expect(opened).toHaveLength(0);
      }),
  );

  it.each(["bytes=0-1,4-5", "items=0-1", "bytes=wat", "bytes=-"])(
    "ignores unsupported or malformed %s",
    (range) =>
      withServer(async (origin) => {
        const response = await fetch(`${origin}/assets/app-a1b2.js`, { headers: { range } });
        expect(response.status).toBe(200);
        expect(await response.text()).toBe("0123456789");
      }),
  );

  it("handles empty files and their unsatisfiable ranges", () =>
    withServer(async (origin, opened) => {
      const url = `${origin}/assets/empty.txt`;
      const response = await fetch(url);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("");
      const range = await fetch(url, { headers: { range: "bytes=0-" } });
      expect(range.status).toBe(416);
      expect(range.headers.get("content-range")).toBe("bytes */0");
      expect(await range.text()).toBe("");
      expect(opened).toHaveLength(1);
    }));

  it("ignores ranges for stale, invalid or weak If-Range validators", () =>
    withServer(async (origin) => {
      const url = `${origin}/assets/app-a1b2.js`;
      const head = await fetch(url, { method: "HEAD" });
      for (const validator of [
        head.headers.get("etag") ?? "",
        '"different"',
        "invalid",
        "Wed, 01 Jan 2020 00:00:00 GMT",
        "Wed, 01 Jan 2100 00:00:00 GMT",
      ]) {
        const response = await fetch(url, {
          headers: { range: "bytes=1-2", "if-range": validator },
        });
        expect(response.status).toBe(200);
        expect(await response.text()).toBe("0123456789");
      }
      const response = await fetch(url, {
        headers: { range: "bytes=1-2", "if-range": head.headers.get("last-modified") ?? "" },
      });
      expect(response.status).toBe(206);
      expect(await response.text()).toBe("12");
    }));

  it("honors a matching strong If-Range without constructing a discarded full body", () =>
    withServer(
      async (origin, opened) => {
        const url = `${origin}/assets/app-a1b2.js`;
        const head = await fetch(url, { method: "HEAD" });
        const response = await fetch(url, {
          headers: { range: "bytes=1-2", "if-range": head.headers.get("etag") ?? "" },
        });
        expect(response.status).toBe(206);
        expect(await response.text()).toBe("12");
        expect(opened).toHaveLength(1);
      },
      { strongEtags: true },
    ));

  it("does not install SPA/directory fallback, steal protocol requests, or handle POST", () =>
    withServer(async (origin) => {
      for (const path of [
        "/",
        "/docs",
        "/docs/",
        "/missing",
        "/assets-other/app-a1b2.js",
        "/_effront/protocol",
      ]) {
        const response = await fetch(`${origin}${path}`);
        expect(response.status).toBe(202);
        expect(await response.text()).toBe("application");
      }
      for (const init of [
        { method: "POST" },
        { headers: { accept: "text/x-component" } },
        { headers: { "x-effront-server-fn": "server-function" } },
      ]) {
        const response = await fetch(`${origin}/robots.txt`, init);
        expect(response.status).toBe(202);
        expect(await response.text()).toBe("application");
      }
      for (const path of ["/assets", "/assets/", "/assets/missing.js"]) {
        const response = await fetch(`${origin}${path}`);
        expect(response.status).toBe(404);
        expect(await response.text()).toBe("");
      }
    }));

  it("rejects raw/encoded traversal, malformed encoding, NUL and backslash", () =>
    withServer(async (origin, opened) => {
      for (const path of [
        "/assets/../secret.txt",
        "/assets/%2e%2e/secret.txt",
        "/assets/%2e%2e%2fsecret.txt",
        "/assets/%00.txt",
        "/assets/%zz",
        "/assets/%5c..%5csecret.txt",
        "/assets/./app-a1b2.js",
      ]) {
        const response = await rawGet(origin, path);
        expect(response.status, path).toBe(404);
        expect(response.body, path).toBe("");
      }
      expect(opened).toHaveLength(0);
    }));

  it("allows in-root symlinks but never serves escaping file/directory symlinks", () =>
    withServer(async (origin, opened) => {
      const inside = await fetch(`${origin}/inside.txt`);
      expect(await inside.text()).toBe("public content");
      expect(opened).toEqual([join(root, "public", "robots.txt")]);
      for (const path of ["/assets/escape.txt", "/assets/outside-directory/robots.txt"]) {
        const response = await fetch(`${origin}${path}`);
        expect(response.status).toBe(404);
        expect(await response.text()).toBe("");
      }
      const publicEscape = await fetch(`${origin}/escape.txt`);
      expect(publicEscape.status).toBe(202);
      expect(await publicEscape.text()).toBe("application");
      expect(opened).toHaveLength(1);
    }));

  it("does not disguise filesystem permission failures as application fallthrough", () =>
    withServer(
      async (origin, opened) => {
        const response = await fetch(`${origin}/robots.txt`);
        expect(response.status).toBe(500);
        expect(await response.text()).toBe("");
        expect(opened).toHaveLength(0);
      },
      { deniedPath: join(root, "public", "robots.txt") },
    ));

  it("fails construction for invalid prefixes and non-directory or missing roots", async () => {
    for (const client of [
      { ...options.client, prefix: "/" },
      { ...options.client, prefix: "assets" },
      { ...options.client, prefix: "/assets/../other" },
      { ...options.client, root: join(root, "missing") },
      { ...options.client, root: join(root, "secret.txt") },
    ]) {
      const result = await Effect.runPromise(
        withAssets(app, { client }).pipe(
          Effect.result,
          Effect.provide(NodeHttpServer.layerHttpServices),
        ),
      );
      expect(Result.isFailure(result)).toBe(true);
    }
  });

  it("destroys the native file stream when the client cancels an asset download", async () => {
    const file = join(root, "client", "large.bin");
    await writeFile(file, "");
    await truncate(file, 64 * 1024 * 1024);
    const closed = Promise.withResolvers<void>();
    let ended = false;
    await withServer(
      async (origin) => {
        await new Promise<void>((resolve, reject) => {
          const request = nodeRequest(
            `${origin}/assets/large.bin`,
            { agent: false },
            (response) => {
              response.once("data", () => response.destroy());
              response.once("close", resolve);
              response.once("error", reject);
            },
          );
          request.once("error", reject);
          request.end();
        });
        await closed.promise;
        expect(ended).toBe(false);
      },
      {
        onFileResponse(response) {
          if (response.body._tag !== "Raw" || !(response.body.body instanceof Readable)) {
            throw new Error("Expected the native Node file stream");
          }
          const stream = response.body.body;
          stream.once("close", () => {
            ended = stream.readableEnded;
            closed.resolve();
          });
        },
      },
    );
  });

  it("preserves external application services and typed failures without construction capture", async () => {
    class External extends Context.Service<External, string>()(
      "@effront/server/test/assets/External",
    ) {}
    const typedApp = Effect.flatMap(External, (value) =>
      value === "fail"
        ? Effect.fail("application-error" as const)
        : Effect.succeed(HttpServerResponse.text(value)),
    );
    const handler = await Effect.runPromise(
      withAssets(typedApp, options).pipe(Effect.provide(NodeHttpServer.layerHttpServices)),
    );
    const request = HttpServerRequest.fromWeb(new Request("http://localhost/missing"));
    const response = await Effect.runPromise(
      handler.pipe(
        Effect.provideService(External, "request-service"),
        Effect.provideService(HttpServerRequest.HttpServerRequest, request),
      ),
    );
    expect(await HttpServerResponse.toWeb(response).text()).toBe("request-service");
    const result = await Effect.runPromise(
      handler.pipe(
        Effect.provideService(External, "fail"),
        Effect.provideService(HttpServerRequest.HttpServerRequest, request),
        Effect.result,
      ),
    );
    expect(Result.isFailure(result) && result.failure).toBe("application-error");
  });
});
