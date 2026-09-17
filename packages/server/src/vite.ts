import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { Effect, Exit, Layer, Scope } from "effect";
import type { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { isRunnableDevEnvironment, type Connect, type Plugin } from "vite";

export type EffrontServerOptions = {
  /** RSC module with a named native Effect `handler` export. Defaults to `src/entry.rsc.ts`. */
  readonly rsc?: string;
  /** Production startup module using Effect's HTTP server. Defaults to `src/entry.server.ts`. */
  readonly server?: string;
};

type NativeHandler = Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  unknown,
  | HttpServerRequest.HttpServerRequest
  | Scope.Scope
  | Layer.Success<typeof NodeHttpServer.layerHttpServices>
>;

const nativeHandler = (module: unknown): NativeHandler => {
  if (
    typeof module !== "object" ||
    module === null ||
    !("handler" in module) ||
    !Effect.isEffect(module.handler)
  ) {
    throw new TypeError("Effront's RSC entry must export a named native Effect HTTP handler.");
  }
  return module.handler as NativeHandler;
};

const makeMiddleware = async (load: () => Promise<unknown>) => {
  const scope = await Effect.runPromise(Scope.make());
  let closing: Promise<void> | undefined;
  const close = () => (closing ??= Effect.runPromise(Scope.close(scope, Exit.void)));

  try {
    // Import on every request, not once during startup. Vite's runner owns the
    // module cache and invalidates it on HMR, including this entry's dependencies.
    const application = Effect.flatMap(Effect.tryPromise(load), (module) =>
      Effect.suspend(() => nativeHandler(module)),
    );
    const context = await Effect.runPromise(
      Layer.buildWithScope(NodeHttpServer.layerHttpServices, scope),
    );
    const handler = await Effect.runPromise(
      NodeHttpServer.makeHandler(application, { scope }).pipe(Effect.provideContext(context)),
    );
    const middleware: Connect.NextHandleFunction = (request, response, next) => {
      if (closing !== undefined) {
        next(new Error("Effront's development HTTP handler has closed."));
        return;
      }
      request.url = request.originalUrl ?? request.url;
      handler(request, response);
    };
    return { middleware, close };
  } catch (error) {
    await close();
    throw error;
  }
};

/**
 * Hosts native Effect HTTP applications in Vite without owning another listener.
 *
 * Register after `effront()`. The RSC entry exports `handler` and accepts HMR,
 * while the separate production entry starts NodeHttpServer or BunHttpServer.
 * Vite development and preview use Node's request/response middleware interface,
 * including when Vite itself runs under Bun's Node compatibility layer.
 */
export const effrontServer = (options: EffrontServerOptions = {}): Plugin => {
  const rsc = options.rsc ?? "./src/entry.rsc.ts";
  const serverEntry = options.server ?? "./src/entry.server.ts";
  if (!rsc || !serverEntry) throw new TypeError("Effront server entries must not be empty.");

  const disposers = new Set<() => Promise<void>>();
  const retain = (instance: Awaited<ReturnType<typeof makeMiddleware>>) => {
    const dispose = async () => {
      try {
        await instance.close();
      } finally {
        disposers.delete(dispose);
      }
    };
    disposers.add(dispose);
    return dispose;
  };

  return {
    name: "effront:server",
    config: (_config, environment) => ({
      resolve: { dedupe: ["react", "react-dom", "effect"] },
      environments: {
        rsc: {
          // Core's distributed HTTP module contains viteRsc.loadModule and must
          // pass through the RSC transform, rather than native Node imports.
          resolve: { noExternal: ["@effront/core"] },
          build: {
            rollupOptions: {
              input: {
                index: rsc,
                ...(environment.command === "build" ? { server: serverEntry } : {}),
              },
              output: { entryFileNames: "[name].js" },
            },
          },
        },
        ssr: { resolve: { noExternal: ["@effront/core"] } },
      },
    }),
    configResolved(config) {
      const portableIndex = config.plugins.findIndex((plugin) => plugin.name === "rsc");
      const hostIndex = config.plugins.findIndex((plugin) => plugin.name === "effront:server");
      if (portableIndex === -1 || portableIndex > hostIndex) {
        throw new TypeError("Register effront() before effrontServer().");
      }
      if (config.command !== "build") return;

      // Vite applies .env NODE_ENV overrides after config/configEnvironment.
      // Pin bundled React to the final client mode, not the startup shell's
      // NODE_ENV. Keep all other process.env access available at runtime.
      const nodeEnv =
        config.environments["client"]?.define?.["process.env.NODE_ENV"] ??
        JSON.stringify(config.isProduction ? "production" : "development");
      for (const name of ["rsc", "ssr"]) {
        const environment = config.environments[name];
        if (environment === undefined) continue;
        environment.define = {
          ...environment.define,
          "process.env.NODE_ENV": nodeEnv,
          "global.process.env.NODE_ENV": nodeEnv,
          "globalThis.process.env.NODE_ENV": nodeEnv,
        };
      }
    },
    async configureServer(server) {
      const environment = server.environments["rsc"];
      if (environment === undefined || !isRunnableDevEnvironment(environment)) {
        throw new TypeError("Effront server hosting requires a runnable RSC environment.");
      }
      const instance = await makeMiddleware(async () => {
        const resolved = await environment.pluginContainer.resolveId(rsc);
        if (resolved === null) throw new TypeError(`Cannot resolve Effront RSC entry: ${rsc}`);
        try {
          return await environment.runner.import(resolved.id);
        } catch (error) {
          if (error instanceof Error) server.ssrFixStacktrace(error);
          throw error;
        }
      });
      const dispose = retain(instance);
      server.httpServer?.once("close", () => {
        void dispose();
      });
      // Keep Vite's transforms, public files, and HMR WebSocket ahead of the
      // application. In particular, never attach a second `request` listener.
      return () => server.middlewares.use(instance.middleware);
    },
    async configurePreviewServer(server) {
      const environment = server.config.environments["rsc"];
      if (environment === undefined) throw new TypeError("Effront requires an RSC build.");
      const entry = pathToFileURL(
        resolve(server.config.root, environment.build.outDir, "index.js"),
      ).href;
      const instance = await makeMiddleware(() => import(/* @vite-ignore */ entry));
      const dispose = retain(instance);
      server.httpServer.once("close", () => {
        void dispose();
      });
      return () => server.middlewares.use(instance.middleware);
    },
    async closeBundle() {
      // Vite also closes plugin containers in middleware mode, where httpServer
      // is null, and when restarting after configuration changes.
      await Promise.all([...disposers].map((dispose) => dispose()));
    },
  };
};
