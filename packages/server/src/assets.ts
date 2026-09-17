import { Effect, type FileSystem, type Path } from "effect";
import { type PlatformError } from "effect/PlatformError";
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

/**
 * Adds client and public files to a native Effect HTTP application.
 *
 * Construction captures standard filesystem services, not request services.
 * The host still owns request scopes and consumes or cancels response bodies.
 * Only GET/HEAD are handled. Client namespace misses are 404; public misses run the application.
 * There are no directory indexes or SPA fallbacks. Flight and Server Function requests bypass
 * public assets. Filesystem errors other than missing files remain typed HTTP failures.
 * Path resolution, HTTP metadata, ranges and conditionals follow Effect HttpStaticServer semantics.
 * The standard lazy-stream HttpPlatform avoids opening discarded HEAD/304 bodies.
 *
 * Deployment/public roots must be trusted. No additional symlink containment or startup
 * filesystem validation is performed beyond the standard server.
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
    const prefix = options.client.prefix.replace(/\/+$/, "");
    const mount = (options: Omit<AssetMount, "prefix">) =>
      HttpStaticServer.make({
        root: options.root,
        // Explicit undefined disables the default index.html.
        index: undefined,
        spa: false,
        cacheControl: options.cacheControl ?? "public, max-age=0, must-revalidate",
      }).pipe(Effect.provide(HttpPlatform.layer));
    const client = yield* mount(options.client);
    const publicFiles = options.public === undefined ? undefined : yield* mount(options.public);

    return Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      if (request.method !== "GET" && request.method !== "HEAD") return yield* app;
      const pathname = request.url.split("?", 1)[0] ?? "";
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
      // make() resolves the whole URL. Remove only the dedicated prefix and leave
      // decoding, normalization and filesystem lookup to the standard server.
      return yield* serve.pipe(
        Effect.provideService(
          HttpServerRequest.HttpServerRequest,
          isClient ? request.modify({ url: request.url.slice(prefix.length) || "/" }) : request,
        ),
        Effect.catchIf(
          (error) => error.reason._tag === "RouteNotFound",
          () => (isClient ? Effect.succeed(HttpServerResponse.empty({ status: 404 })) : app),
        ),
      );
    });
  });
