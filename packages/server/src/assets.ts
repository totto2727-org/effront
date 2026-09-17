import { Effect, FileSystem, Path } from "effect";
import { badArgument, type PlatformError } from "effect/PlatformError";
import {
  HttpPlatform,
  HttpServerError,
  HttpServerRequest,
  HttpServerResponse,
  HttpStaticServer,
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

/**
 * Adds client and public files to a native Effect HTTP application.
 *
 * Construction validates and canonicalizes roots and captures platform services, not request
 * services. The host still owns request scopes and consumes or cancels response bodies.
 * Only GET/HEAD are handled. Client namespace misses are 404; public misses run the application.
 * There are no directory indexes or SPA fallbacks. Flight and Server Function requests bypass
 * public assets. Filesystem errors other than missing files remain typed HTTP failures.
 * HTTP metadata, ranges and conditionals follow Effect HttpStaticServer semantics.
 * The standard lazy-stream HttpPlatform avoids opening discarded HEAD/304 bodies.
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
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
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
    const mount = Effect.fnUntraced(function* (options: Omit<AssetMount, "prefix">) {
      const root = yield* canonicalRoot(options.root);
      // Explicit undefined disables the default index.html. The standard portable platform
      // uses lazy filesystem streams, unlike Node's eager native fileResponse body.
      const handler = yield* HttpStaticServer.make({
        root,
        index: undefined,
        spa: false,
        cacheControl: options.cacheControl ?? "public, max-age=0, must-revalidate",
      }).pipe(Effect.provide(HttpPlatform.layer));
      return Effect.fnUntraced(function* (
        request: HttpServerRequest.HttpServerRequest,
        pathname: string,
      ) {
        const notFound = () =>
          new HttpServerError.HttpServerError({
            reason: new HttpServerError.RouteNotFound({ request }),
          });
        const canonical = yield* fs.realPath(path.resolve(root, `.${pathname}`)).pipe(
          Effect.mapError((cause) =>
            cause.reason._tag === "NotFound"
              ? notFound()
              : new HttpServerError.HttpServerError({
                  reason: new HttpServerError.InternalError({ request, cause }),
                }),
          ),
        );
        if (!within(path, root, canonical)) return yield* Effect.fail(notFound());
        // make() resolves the entire request URL, not a router prefix. Re-encode each
        // canonical segment so its own decoding cannot reinterpret literal %, ? or #.
        const url = `/${path.relative(root, canonical).split(path.sep).map(encodeURIComponent).join("/")}`;
        return yield* handler.pipe(
          Effect.provideService(HttpServerRequest.HttpServerRequest, request.modify({ url })),
        );
      });
    });
    const client = yield* mount(options.client);
    const publicFiles = options.public === undefined ? undefined : yield* mount(options.public);

    return Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      if (request.method !== "GET" && request.method !== "HEAD") return yield* app;
      const pathname = decodePath(request.url);
      if (pathname === undefined) return HttpServerResponse.empty({ status: 404 });
      const isClient = pathname === prefix || pathname.startsWith(`${prefix}/`);
      const publicProtocol =
        pathname === "/_effront" ||
        pathname.startsWith("/_effront/") ||
        request.headers["accept"]
          ?.split(",")
          .some((value) => value.trim().split(";", 1)[0] === "text/x-component") ||
        request.headers["x-effront-server-fn"] !== undefined;
      if (!isClient && (publicFiles === undefined || publicProtocol)) return yield* app;
      const serve = isClient ? client : publicFiles;
      if (serve === undefined) return yield* app;
      return yield* serve(request, isClient ? pathname.slice(prefix.length) || "/" : pathname).pipe(
        Effect.catchIf(
          (error) => error.reason._tag === "RouteNotFound",
          () => (isClient ? Effect.succeed(HttpServerResponse.empty({ status: 404 })) : app),
        ),
      );
    });
  });
