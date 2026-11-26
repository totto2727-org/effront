// oxlint-disable-next-line rules/no-node-imports -- The native TCP fixtures need the actual Node listener and unnormalized request targets.
import { createServer, request as nodeRequest } from "node:http";

import { NodeHttpServer, NodeServices } from "@effect/platform-node";
import { Data, Effect, Exit, FileSystem, Layer, Path, PlatformError, Scope, Stream } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpServer,
  HttpServerResponse,
} from "effect/http";
import type { HttpClientError, HttpClientResponse } from "effect/http";

import { withAssets } from "./assets.ts";
import type { AssetOptions } from "./assets.ts";

export const applicationStatus = 202;
export const fileBody = "0123456789";
export const immutableCache = "public, max-age=31536000, immutable";

const assets = [
  ["client/app-a1b2.js", fileBody],
  ["client/empty.txt", ""],
  ["public/robots.txt", "public content"],
  ["public/icon.svg", "<svg/>"],
  ["public/unknown.extension", "unknown"],
  ["public/index.html", "not an SPA"],
  ["public/docs/index.html", "not a directory index"],
  ["public/_effront/protocol", "not a protocol response"],
  ["secret.txt", "outside secret"],
] as const;

const temporaryAssetDirectory = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const temporaryRoot = yield* path.fromFileUrl(new URL("../../../tmp/", import.meta.url));
  yield* fs.makeDirectory(temporaryRoot, { recursive: true });
  return yield* fs.makeTempDirectoryScoped({
    directory: temporaryRoot,
    prefix: "server-assets-",
  });
});

export const assetFiles = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* temporaryAssetDirectory;
  const client = path.join(root, "client");
  const publicRoot = path.join(root, "public");
  yield* Effect.forEach(
    [client, path.join(publicRoot, "docs"), path.join(publicRoot, "_effront")],
    (directory) => fs.makeDirectory(directory, { recursive: true }),
  );
  yield* Effect.forEach(assets, ([file, content]) =>
    fs.writeFileString(path.join(root, file), content),
  );
  const options: AssetOptions = {
    client: { cacheControl: immutableCache, prefix: "/assets", root: client },
    public: { root: publicRoot },
  };
  return { fs, options, path, root };
}).pipe(Effect.provide(NodeServices.layer));

interface FixtureSettings {
  deniedStatPath?: string;
  onStreamExit?: (completed: boolean) => Effect.Effect<void>;
}

const instrumentFilesystem = (
  fs: FileSystem.FileSystem,
  opened: string[],
  settings: FixtureSettings,
): FileSystem.FileSystem => ({
  ...fs,
  stat: (file) =>
    file === settings.deniedStatPath
      ? Effect.fail(
          PlatformError.systemError({
            // oxlint-disable-next-line rules/require-tagged-data -- PlatformError requires the native filesystem error tag.
            _tag: "PermissionDenied",
            method: "stat",
            module: "FileSystem",
          }),
        )
      : fs.stat(file),
  stream: (file, streamOptions) =>
    Stream.unwrap(
      Effect.sync(() => {
        opened.push(file);
        const stream = fs.stream(file, streamOptions);
        return stream.pipe(
          Stream.onExit((exit) => settings.onStreamExit?.(Exit.isSuccess(exit)) ?? Effect.void),
        );
      }),
    ),
});

const nodeServer = NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 });
const application = Effect.succeed(
  HttpServerResponse.text("application", { status: applicationStatus }),
);

export const startAssetServer = Effect.fnUntraced(function* (
  options: AssetOptions,
  settings: FixtureSettings,
) {
  const scope = yield* Scope.Scope;
  const context = yield* Layer.buildWithScope(nodeServer, scope);
  const fs = yield* FileSystem.FileSystem.pipe(Effect.provideContext(context));
  const opened: string[] = [];
  const layer = instrumentFilesystem(fs, opened, settings);
  const handler = yield* withAssets(application, options).pipe(
    Effect.provideService(FileSystem.FileSystem, layer),
    Effect.provideContext(context),
  );
  yield* HttpServer.serveEffect(handler).pipe(Effect.provideContext(context));
  const origin = yield* HttpServer.addressFormattedWith(Effect.succeed).pipe(
    Effect.provideContext(context),
  );
  return { opened, origin };
});

export const standardAssetServer = Effect.gen(function* () {
  const { options } = yield* assetFiles;
  return yield* startAssetServer(options, {});
});

export const requestAsset = (
  url: string,
  options: Pick<HttpClientRequest.Options, "headers" | "method"> = {},
): Effect.Effect<HttpClientResponse.HttpClientResponse, HttpClientError.HttpClientError> => {
  // Each test owns its listener. Close connections after their response so scope teardown need not wait for keep-alive.
  const request = HttpClientRequest.make(options.method ?? "GET")(url, options).pipe(
    HttpClientRequest.setHeader("connection", "close"),
  );
  return HttpClient.execute(request).pipe(Effect.provide(FetchHttpClient.layer));
};

class NativeRequestFailure extends Data.TaggedError("NativeRequestFailure")<{
  cause: unknown;
  message: string;
}> {}

const missingNativeStatus = 0;

interface RawResponse {
  body: string;
  status: number;
}

// Node's request API preserves raw request targets that Fetch normalizes.
export const rawGet = (
  origin: string,
  path: string,
): Effect.Effect<RawResponse, NativeRequestFailure> =>
  Effect.callback((resume) => {
    const fail = (cause: unknown): void => {
      resume(
        Effect.fail(new NativeRequestFailure({ cause, message: "Native asset request failed" })),
      );
    };
    const request = nodeRequest(`${origin}/`, { agent: false, path }, (response) => {
      const chunks: string[] = [];
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => {
        chunks.push(chunk);
      });
      response.once("end", () => {
        const result = {
          body: chunks.join(""),
          status: response.statusCode ?? missingNativeStatus,
        };
        resume(Effect.succeed(result));
      });
      response.once("error", fail);
    });
    request.once("error", fail);
    request.end();
    return Effect.sync(() => {
      request.destroy();
    });
  });

export const cancelDownload = (url: string): Effect.Effect<void, NativeRequestFailure> =>
  Effect.callback((resume) => {
    const fail = (cause: unknown): void => {
      resume(Effect.fail(new NativeRequestFailure({ cause, message: "Native download failed" })));
    };
    const request = nodeRequest(url, { agent: false }, (response) => {
      response.once("data", () => {
        response.destroy();
      });
      response.once("close", () => {
        resume(Effect.void);
      });
      response.once("error", fail);
    });
    request.once("error", fail);
    request.end();
    return Effect.sync(() => {
      request.destroy();
    });
  });
