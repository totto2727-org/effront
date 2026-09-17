import { BunHttpServer } from "@effect/platform-bun";
import { Effect, Layer } from "effect";
import { HttpServer } from "effect/unstable/http";
import type { HttpServerResponse } from "effect/unstable/http/HttpServerResponse";
import { withAssets, type AssetOptions } from "./assets";

export interface ServeOptions {
  readonly assets: AssetOptions;
  readonly port?: number;
  readonly hostname?: string;
}

/** A scoped native Bun HTTP server. Launch with Layer.launch and BunRuntime.runMain. */
export const serve = <E, R>(
  handler: Effect.Effect<HttpServerResponse, E, R>,
  options: ServeOptions,
) =>
  Layer.unwrap(
    Effect.map(withAssets(handler, options.assets), (app) => HttpServer.serve(app)),
  ).pipe(
    Layer.provide(
      BunHttpServer.layer({
        port: options.port ?? 3000,
        hostname: options.hostname ?? "127.0.0.1",
        development: false,
        idleTimeout: 0,
        maxRequestBodySize: 10 * 1024 * 1024,
      }),
    ),
  );
