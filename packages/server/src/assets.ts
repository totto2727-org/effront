import { Effect, FileSystem, Option, Path } from "effect";
import { badArgument, type PlatformError } from "effect/PlatformError";
import {
  Etag,
  HttpPlatform,
  HttpServerError,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";

export interface AssetMount {
  readonly root: string;
  /** Dedicated URL namespace, for example `/_effront/assets`. */
  readonly prefix: string;
  /** Defaults to revalidation. Opt into immutable caching only for hashed output. */
  readonly cacheControl?: string;
}

export interface AssetOptions {
  readonly client: AssetMount;
  /** Exact file matches only. Directories and missing files fall through to the application. */
  readonly public?: Omit<AssetMount, "prefix">;
}

const mimeTypes: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
};

const decodePath = (url: string): string | undefined => {
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.split("?", 1)[0] ?? "");
  } catch {
    return undefined;
  }
  if (
    !pathname.startsWith("/") ||
    pathname.includes("\0") ||
    pathname.includes("\\") ||
    pathname.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    return undefined;
  }
  return pathname;
};

const within = (path: Path.Path, root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate);
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};

type ByteRange = { readonly start: bigint; readonly end: bigint };

// Unsupported units, malformed ranges and multipart ranges are deliberately ignored (200).
const parseRange = (header: string, size: bigint): ByteRange | "unsatisfiable" | undefined => {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (match === null) return undefined;
  const first = match[1] ?? "";
  const last = match[2] ?? "";
  if (first === "" && last === "") return undefined;
  if (first === "") {
    const suffix = BigInt(last);
    if (suffix === 0n || size === 0n) return "unsatisfiable";
    return { start: suffix >= size ? 0n : size - suffix, end: size - 1n };
  }
  const start = BigInt(first);
  const end = last === "" ? size - 1n : BigInt(last);
  if (start >= size || start > end) return "unsatisfiable";
  return { start, end: end >= size ? size - 1n : end };
};

const modifiedSince = (value: string, lastModified: string | undefined): boolean => {
  if (lastModified === undefined) return true;
  const since = Date.parse(value);
  return Number.isNaN(since) || Date.parse(lastModified) > since;
};

const matchesEtag = (value: string, etag: string): boolean =>
  value.split(",").some((entry) => {
    const candidate = entry.trim();
    return candidate === "*" || candidate.replace(/^W\//, "") === etag.replace(/^W\//, "");
  });

const matchesIfRange = (value: string, etag: string, lastModified: string | undefined): boolean => {
  const candidate = value.trim();
  if (candidate.startsWith('"') || candidate.startsWith("W/")) {
    return !candidate.startsWith("W/") && !etag.startsWith("W/") && candidate === etag;
  }
  // Unlike If-Modified-Since, If-Range requires an exact validator match.
  return lastModified !== undefined && Date.parse(candidate) === Date.parse(lastModified);
};

/**
 * Adds client and public files to a native Effect HTTP application.
 *
 * Construction validates and canonicalizes roots and captures platform services, not request
 * services. The host still owns request scopes and consumes or cancels response bodies.
 * Only GET/HEAD are handled. Client namespace misses are 404; public misses run the application.
 * There are no directory indexes or SPA fallbacks. Flight and Server Function requests bypass
 * public assets. Filesystem errors other than missing files remain typed HTTP failures.
 * Single byte ranges are supported. Malformed, multipart and unknown-unit ranges are ignored.
 * HEAD ignores Range. If-Range requires a matching strong ETag or Last-Modified date.
 *
 * Canonical containment permits in-root symlinks and rejects escaping symlinks. Asset trees must
 * be trusted/read-only during serving: realPath checks cannot prevent hostile concurrent mutation.
 */
export const withAssets = <E, R>(
  app: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
  options: AssetOptions,
): Effect.Effect<
  Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    E | HttpServerError.HttpServerError,
    R | HttpServerRequest.HttpServerRequest
  >,
  PlatformError,
  FileSystem.FileSystem | Path.Path | HttpPlatform.HttpPlatform | Etag.Generator
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const platform = yield* HttpPlatform.HttpPlatform;
    const etags = yield* Etag.Generator;
    const prefix = options.client.prefix.replace(/\/+$/, "");
    if (
      prefix === "" ||
      decodePath(prefix) !== prefix ||
      prefix.includes("?") ||
      prefix.includes("#") ||
      prefix.includes("//")
    ) {
      return yield* Effect.fail(
        badArgument({
          module: "@effront/server/assets",
          method: "withAssets",
          description: "The client asset prefix must be a non-root, unencoded absolute URL path.",
        }),
      );
    }
    const canonicalRoot = Effect.fnUntraced(function* (root: string) {
      const canonical = yield* fs.realPath(path.resolve(root));
      const info = yield* fs.stat(canonical);
      if (info.type !== "Directory") {
        return yield* Effect.fail(
          badArgument({
            module: "@effront/server/assets",
            method: "withAssets",
            description: "An asset root must be a directory.",
          }),
        );
      }
      return canonical;
    });
    const clientRoot = yield* canonicalRoot(options.client.root);
    const publicRoot =
      options.public === undefined ? undefined : yield* canonicalRoot(options.public.root);

    const findFile = Effect.fnUntraced(function* (root: string, pathname: string) {
      const candidate = path.resolve(root, `.${pathname}`);
      if (!within(path, root, candidate)) return undefined;
      const canonical = yield* fs.realPath(candidate);
      if (!within(path, root, canonical)) return undefined;
      const info = yield* fs.stat(canonical);
      return info.type === "File" ? { canonical, info } : undefined;
    });

    const serveFile = Effect.fnUntraced(function* (
      request: HttpServerRequest.HttpServerRequest,
      root: string,
      pathname: string,
      cacheControl: string,
    ) {
      const file = yield* findFile(root, pathname);
      if (file === undefined) return undefined;
      const etag = Etag.toString(yield* etags.fromFileInfo(file.info));
      const lastModified = Option.isSome(file.info.mtime)
        ? file.info.mtime.value.toUTCString()
        : undefined;
      const validators: Record<string, string> = { etag, "cache-control": cacheControl };
      if (lastModified !== undefined) validators["last-modified"] = lastModified;

      const ifNoneMatch = request.headers["if-none-match"];
      const ifModifiedSince = request.headers["if-modified-since"];
      if (
        ifNoneMatch !== undefined
          ? matchesEtag(ifNoneMatch, etag)
          : ifModifiedSince !== undefined && !modifiedSince(ifModifiedSince, lastModified)
      ) {
        return HttpServerResponse.empty({ status: 304, headers: validators });
      }

      const headers: Record<string, string> = {
        ...validators,
        "accept-ranges": "bytes",
        "content-type":
          mimeTypes[path.extname(pathname).toLowerCase()] ?? "application/octet-stream",
        "content-length": file.info.size.toString(),
      };
      // Never construct a platform body for HEAD: Node fileResponse opens a stream eagerly.
      if (request.method === "HEAD") return HttpServerResponse.empty({ status: 200, headers });

      const rangeHeader = request.headers["range"];
      const ifRange = request.headers["if-range"];
      const range =
        rangeHeader !== undefined &&
        (ifRange === undefined || matchesIfRange(ifRange, etag, lastModified))
          ? parseRange(rangeHeader, file.info.size)
          : undefined;
      if (range === "unsatisfiable") {
        return HttpServerResponse.empty({
          status: 416,
          headers: {
            ...validators,
            "accept-ranges": "bytes",
            "content-range": `bytes */${file.info.size}`,
          },
        });
      }
      if (range !== undefined) {
        headers["content-range"] = `bytes ${range.start}-${range.end}/${file.info.size}`;
        headers["content-length"] = (range.end - range.start + 1n).toString();
      }
      const response = yield* platform.fileResponse(file.canonical, {
        status: range === undefined ? 200 : 206,
        ...(range === undefined
          ? {}
          : { offset: range.start, bytesToRead: range.end - range.start + 1n }),
        headers,
      });
      // The host platform may use a different ETag generator. Keep the same validators as HEAD/304.
      return HttpServerResponse.setHeaders(response, headers);
    });

    return Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      if (request.method !== "GET" && request.method !== "HEAD") return yield* app;
      const pathname = decodePath(request.url);
      if (pathname === undefined) return HttpServerResponse.empty({ status: 404 });
      const client = pathname === prefix || pathname.startsWith(`${prefix}/`);
      const publicProtocol =
        pathname === "/_effront" ||
        pathname.startsWith("/_effront/") ||
        request.headers["accept"]
          ?.split(",")
          .some((value) => value.trim().split(";", 1)[0] === "text/x-component") ||
        request.headers["x-effront-server-fn"] !== undefined;
      if (!client && (publicRoot === undefined || publicProtocol)) return yield* app;
      const root = client ? clientRoot : publicRoot;
      if (root === undefined) return yield* app;
      const response = yield* serveFile(
        request,
        root,
        client ? pathname.slice(prefix.length) || "/" : pathname,
        (client ? options.client.cacheControl : options.public?.cacheControl) ??
          "public, max-age=0, must-revalidate",
      ).pipe(
        Effect.catch((cause) =>
          cause.reason._tag === "NotFound"
            ? Effect.succeed(undefined)
            : Effect.fail(
                new HttpServerError.HttpServerError({
                  reason: new HttpServerError.InternalError({ request, cause }),
                }),
              ),
        ),
      );
      return response ?? (client ? HttpServerResponse.empty({ status: 404 }) : yield* app);
    });
  });
