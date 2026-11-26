import { Effect, Option, Predicate, String } from "effect";
import type { FileSystem, Path, PlatformError } from "effect";
import { HttpPlatform, HttpServerRequest, HttpServerResponse, HttpStaticServer } from "effect/http";
import type { HttpServerError } from "effect/http";

type AssetMountFields = Readonly<{
  root: string;
  /** Dedicated URL namespace, for example `/_effront/assets`. */
  prefix: string;
  /** Defaults to revalidation. Opt into immutable caching only for hashed output. */
  cacheControl?: string;
}>;

// oxlint-disable-next-line typescript/no-empty-object-type, typescript/no-empty-interface -- Keep the published interface open to declaration merging.
export interface AssetMount extends AssetMountFields {}

type AssetOptionsFields = Readonly<{
  client: AssetMount;
  /** Exact file matches only. Directories and missing files fall through to the application. */
  public?: Omit<AssetMount, "prefix">;
}>;

// oxlint-disable-next-line typescript/no-empty-object-type, typescript/no-empty-interface -- Keep the published interface open to declaration merging.
export interface AssetOptions extends AssetOptionsFields {}

type ServingApplication<E, R> = Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  E | HttpServerError.HttpServerError,
  R | HttpServerRequest.HttpServerRequest
>;

type StaticApplication = Effect.Success<ReturnType<typeof HttpStaticServer.make>>;

const mount = (
  options: Omit<AssetMount, "prefix">,
): Effect.Effect<
  StaticApplication,
  PlatformError.PlatformError,
  FileSystem.FileSystem | Path.Path
> =>
  HttpStaticServer.make({
    cacheControl: options.cacheControl ?? "public, max-age=0, must-revalidate",
    // Explicit undefined disables the default index.html.
    index: undefined,
    root: options.root,
    spa: false,
  }).pipe(Effect.provide(HttpPlatform.layer));

const before = (value: string, separator: string): string =>
  Option.match(String.indexOf(separator)(value), {
    onNone: () => value,
    onSome: (index) => String.takeLeft(value, index),
  });

const bypassPublicAssets = (
  request: HttpServerRequest.HttpServerRequest,
  pathname: string,
): boolean => {
  const acceptsFlight = request.headers["accept"]
    ?.split(",")
    .some((value) => before(value.trim(), ";") === "text/x-component");
  return (
    pathname === "/_effront" ||
    pathname.startsWith("/_effront/") ||
    acceptsFlight === true ||
    Predicate.isNotNullish(request.headers["x-effront-server-fn"])
  );
};

const stripClientPrefix = (
  request: HttpServerRequest.HttpServerRequest,
  prefix: string,
): HttpServerRequest.HttpServerRequest => {
  const suffix = request.url.slice(prefix.length);
  return request.modify({ url: String.isEmpty(suffix) ? "/" : suffix });
};

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
 * @param {Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>} app The downstream application.
 * @param {AssetOptions} options The client mount and optional exact public asset root.
 * @returns {Effect.Effect} A filesystem-backed application with the existing request scope.
 */
export const withAssets = <E, R>(
  app: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
  options: AssetOptions,
): Effect.Effect<
  ServingApplication<E, R>,
  PlatformError.PlatformError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const prefix = options.client.prefix.replace(/\/+$/u, "");
    const client = yield* mount(options.client);
    const publicFiles = Predicate.isNullish(options.public)
      ? undefined
      : yield* mount(options.public);

    return Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      if (request.method !== "GET" && request.method !== "HEAD") {
        return yield* app;
      }
      const pathname = before(request.url, "?");
      const isClient = pathname === prefix || pathname.startsWith(`${prefix}/`);
      const serve = isClient ? client : publicFiles;
      if (Predicate.isNullish(serve) || (!isClient && bypassPublicAssets(request, pathname))) {
        return yield* app;
      }
      const incoming = isClient ? stripClientPrefix(request, prefix) : request;
      return yield* serve.pipe(
        Effect.provideService(HttpServerRequest.HttpServerRequest, incoming),
        Effect.catchIf(
          (error) => Predicate.isTagged(error.reason, "RouteNotFound"),
          () => (isClient ? Effect.succeed(HttpServerResponse.empty({ status: 404 })) : app),
        ),
      );
    });
  });
