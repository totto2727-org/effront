import "effect/unstable/schema/SchemaJITCompiler/enable";
import { NodeHttpServer } from "@effect/platform-node";
import { createServer } from "node:http";
import { Effect, Layer } from "effect";
import { HttpServer } from "effect/unstable/http";
import type { HttpServerResponse } from "effect/unstable/http/HttpServerResponse";
import { withAssets, type AssetOptions } from "./assets";

export interface ServeOptions {
  readonly assets: AssetOptions;
  readonly port?: number;
  readonly hostname?: string;
}

/** A scoped native Node HTTP server. Launch with Layer.launch and NodeRuntime.runMain. */
export const serve = <E, R>(
  handler: Effect.Effect<HttpServerResponse, E, R>,
  options: ServeOptions,
) =>
  Layer.unwrap(
    Effect.map(withAssets(handler, options.assets), (app) => HttpServer.serve(app)),
  ).pipe(
    Layer.provide(
      NodeHttpServer.layer(createServer, {
        port: options.port ?? 3000,
        host: options.hostname ?? "127.0.0.1",
      }),
    ),
  );
