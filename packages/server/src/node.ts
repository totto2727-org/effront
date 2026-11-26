// oxlint-disable-next-line import/no-unassigned-import -- The JIT module registers Effect Schema compilation for this host.
import "effect/schema/SchemaJITCompiler/enable";

import { NodeHttpServer } from "@effect/platform-node";
// oxlint-disable-next-line rules/no-node-imports -- Effect's Node HTTP layer takes the real Node server factory.
import { createServer } from "node:http";

import { Effect, Layer } from "effect";
import type { PlatformError, Scope } from "effect";
import { HttpServer } from "effect/http";
import type { HttpServerRequest, HttpServerResponse } from "effect/http";

import { withAssets } from "./assets.ts";
import type { AssetOptions } from "./assets.ts";

type ServeOptionsFields = Readonly<{
  assets: AssetOptions;
  hostname?: string;
  port?: number;
}>;

// oxlint-disable-next-line typescript/no-empty-object-type, typescript/no-empty-interface -- Preserve declaration merging on the public host options.
export interface ServeOptions extends ServeOptionsFields {}

const defaultHostname = "127.0.0.1";
const defaultPort = 3000;

type RequestServices = HttpServerRequest.HttpServerRequest | Scope.Scope;
type NativeLayer = ReturnType<typeof NodeHttpServer.layer>;
type ServeLayer<R> = Layer.Layer<
  never,
  PlatformError.PlatformError | Layer.Error<NativeLayer>,
  Exclude<Exclude<R, RequestServices>, Layer.Success<NativeLayer>>
>;

/**
 * Creates a scoped native Node HTTP server.
 * @param {Effect.Effect} handler The native HTTP application.
 * @param {ServeOptions} options The listening address and static asset mounts.
 * @returns {Layer.Layer} A server layer to start with Layer.launch.
 */
export const serve = <E, R>(
  handler: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
  options: ServeOptions,
): ServeLayer<R> => {
  const application = withAssets(handler, options.assets);
  const serveApplication = Effect.map(application, (app) => HttpServer.serve(app));
  const host = NodeHttpServer.layer(createServer, {
    host: options.hostname ?? defaultHostname,
    port: options.port ?? defaultPort,
  });
  return Layer.unwrap(serveApplication).pipe(Layer.provide(host));
};
