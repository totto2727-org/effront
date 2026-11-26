// oxlint-disable-next-line rules/no-node-imports -- Vite compression expects the native Node HTTP reason phrase.
import { STATUS_CODES } from "node:http";

import { NodeHttpServer, NodeServices } from "@effect/platform-node";
import { Data, Effect, Exit, Layer, Path, Predicate, Scope } from "effect";
import { HttpEffect, HttpServerResponse } from "effect/http";
import type { HttpServerRequest } from "effect/http";
import { isRunnableDevEnvironment } from "vite";
import type {
  ConfigEnv,
  Connect,
  Plugin,
  PreviewServer,
  ResolvedConfig,
  UserConfig,
  ViteDevServer,
} from "vite";

export type EffrontServerOptions = Readonly<{
  /** RSC module with a named native Effect `handler` export. Defaults to `src/entry.rsc.ts`. */
  rsc?: string;
  /** Production startup module using Effect's HTTP server. Defaults to `src/entry.server.ts`. */
  server?: string;
}>;

type NativeHandler = Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  unknown,
  | HttpServerRequest.HttpServerRequest
  | Scope.Scope
  | Layer.Success<typeof NodeHttpServer.layerHttpServices>
>;
type LoadRsc = () => Promise<unknown>;
type Dispose = () => Promise<void>;
type ViteHost = ViteDevServer | PreviewServer;

interface Middleware {
  close: Dispose;
  middleware: Connect.NextHandleFunction;
}

class DevelopmentHandlerClosed extends Data.TaggedError("DevelopmentHandlerClosed")<{
  message: string;
}> {}

const serverPluginName = "effront:server";
const missingPluginIndex = -1;
const invalidConfig = (message: string): TypeError =>
  // oxlint-disable-next-line rules/require-tagged-error -- Preserve native TypeError at the public Vite plugin boundary.
  new TypeError(message);

const nativeHandler = (module: unknown): NativeHandler => {
  if (!Predicate.hasProperty(module, "handler") || !Effect.isEffect(module.handler)) {
    throw invalidConfig("Effront's RSC entry must export a named native Effect HTTP handler.");
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The Effect brand verifies the RSC export at runtime; its HTTP context parameters are compile-time only.
  return module.handler as NativeHandler;
};

const responseReason = (
  _request: HttpServerRequest.HttpServerRequest,
  response: HttpServerResponse.HttpServerResponse,
): Effect.Effect<HttpServerResponse.HttpServerResponse> => {
  const statusText = response.statusText ?? STATUS_CODES[response.status] ?? "";
  return Effect.succeed(HttpServerResponse.setStatus(response, response.status, statusText));
};

const attachMiddleware = Effect.fnUntraced(function* (load: LoadRsc, scope: Scope.Closeable) {
  // Vite invalidates the module and its dependencies on HMR, so load it on every request.
  const application = Effect.flatMap(Effect.tryPromise(load), (module) =>
    Effect.suspend(() => nativeHandler(module)),
  );
  const context = yield* Layer.buildWithScope(NodeHttpServer.layerHttpServices, scope);
  // Vite compression expects a string reason for the three-argument writeHead call.
  const served = HttpEffect.withPreResponseHandler(application, responseReason);
  const native = NodeHttpServer.makeHandler(served, { scope });
  const handler = yield* native.pipe(Effect.provideContext(context));
  const shutdown: { pending?: Promise<void> } = {};
  const closeEffect = Scope.close(scope, Exit.void);
  // oxlint-disable-next-line typescript/promise-function-async -- Repeated host shutdown callbacks share the same completion promise.
  const close = (): Promise<void> => {
    // oxlint-disable-next-line rules/no-effect-runtime-run -- Vite invokes the native Promise shutdown callback outside an Effect runtime.
    shutdown.pending ??= Effect.runPromise(closeEffect);
    return shutdown.pending;
  };
  const middleware: Connect.NextHandleFunction = (request, response, next) => {
    if (Predicate.isNotNullish(shutdown.pending)) {
      next(
        new DevelopmentHandlerClosed({ message: "Effront's development HTTP handler has closed." }),
      );
      return;
    }
    request.url = request.originalUrl ?? request.url;
    handler(request, response);
  };
  return { close, middleware } satisfies Middleware;
});

const makeMiddleware = Effect.fnUntraced(function* (load: LoadRsc) {
  const scope = yield* Scope.make();
  return yield* attachMiddleware(load, scope).pipe(
    Effect.onError(() => Scope.close(scope, Exit.void)),
  );
});

const retain = (instance: Middleware, disposers: Set<Dispose>): Dispose => {
  const dispose = async (): Promise<void> => {
    try {
      await instance.close();
    } finally {
      disposers.delete(dispose);
    }
  };
  disposers.add(dispose);
  return dispose;
};

const mount = (server: ViteHost, instance: Middleware, disposers: Set<Dispose>): (() => void) => {
  const dispose = retain(instance, disposers);
  server.httpServer?.once("close", () => {
    // oxlint-disable-next-line promise/prefer-await-to-then -- The native close listener is synchronous and does not await returned promises.
    dispose().catch(() => {
      server.config.logger.error("Effront could not close its native HTTP middleware scope.");
    });
  });
  // Vite's transforms, public files, and HMR WebSocket stay ahead of the app.
  return () => {
    server.middlewares.use(instance.middleware);
  };
};

const hostConfig = (rsc: string, server: string, environment: ConfigEnv): UserConfig => ({
  environments: {
    rsc: {
      build: {
        // oxlint-disable-next-line typescript/no-deprecated -- The package supports Vite peers that expose only rollupOptions.
        rollupOptions: {
          input: { index: rsc, ...(environment.command === "build" ? { server } : {}) },
          output: { entryFileNames: "[name].js" },
        },
      },
      // Core's distributed HTTP renderer contains viteRsc.loadModule and needs the RSC transform.
      resolve: { noExternal: ["@effront/core"] },
    },
    ssr: { resolve: { noExternal: ["@effront/core"] } },
  },
  resolve: { dedupe: ["react", "react-dom", "effect"] },
});

const pinReactEnv = (config: ResolvedConfig): void => {
  const portableIndex = config.plugins.findIndex(({ name }) => name === "rsc");
  const hostIndex = config.plugins.findIndex(({ name }) => name === serverPluginName);
  if (portableIndex === missingPluginIndex || portableIndex > hostIndex) {
    throw invalidConfig("Register effront() before effrontServer().");
  }
  if (config.command !== "build") {
    return;
  }
  // Use the final client mode after Vite applies .env overrides.
  const defaultMode = config.isProduction ? "production" : "development";
  const clientMode: unknown = config.environments["client"]?.define?.["process.env.NODE_ENV"];
  const nodeEnv = clientMode ?? JSON.stringify(defaultMode);
  ["rsc", "ssr"].forEach((name) => {
    const environment = config.environments[name];
    if (Predicate.isNullish(environment)) {
      return;
    }
    environment.define = {
      ...environment.define,
      "global.process.env.NODE_ENV": nodeEnv,
      "globalThis.process.env.NODE_ENV": nodeEnv,
      "process.env.NODE_ENV": nodeEnv,
    };
  });
};

const devLoader = (server: ViteDevServer, rsc: string): LoadRsc => {
  const environment = server.environments["rsc"];
  if (Predicate.isNullish(environment) || !isRunnableDevEnvironment(environment)) {
    throw invalidConfig("Effront server hosting requires a runnable RSC environment.");
  }
  return async () => {
    const resolved = await environment.pluginContainer.resolveId(rsc);
    if (Predicate.isNullish(resolved)) {
      throw invalidConfig(`Cannot resolve Effront RSC entry: ${rsc}`);
    }
    try {
      const imported: unknown = await environment.runner.import(resolved.id);
      return imported;
    } catch (error) {
      if (Predicate.isError(error)) {
        server.ssrFixStacktrace(error);
      }
      throw error;
    }
  };
};

const previewMiddleware = Effect.fnUntraced(function* (config: ResolvedConfig) {
  const environment = config.environments["rsc"];
  if (Predicate.isNullish(environment)) {
    throw invalidConfig("Effront requires an RSC build.");
  }
  const path = yield* Path.Path;
  const outDir = path.resolve(config.root, environment.build.outDir, "index.js");
  const entry = yield* path.toFileUrl(outDir);
  // oxlint-disable-next-line eslint/no-inline-comments -- Vite must see the directive inside the import of the built RSC entry.
  return yield* makeMiddleware(async () => import(/* @vite-ignore */ entry.href));
}, Effect.provide(NodeServices.layer));

/**
 * Hosts native HTTP applications on the listener Vite already owns.
 * @param {EffrontServerOptions} options RSC handler and production entry paths.
 * @returns {Plugin} The Vite plugin to register after effront().
 */
export const effrontServer = (options: EffrontServerOptions = {}): Plugin => {
  const rsc = options.rsc ?? "./src/entry.rsc.ts";
  const serverEntry = options.server ?? "./src/entry.server.ts";
  if (!rsc || !serverEntry) {
    throw invalidConfig("Effront server entries must not be empty.");
  }

  const disposers = new Set<Dispose>();
  return {
    async closeBundle() {
      // Vite also closes plugin containers in middleware mode and when restarting.
      await Promise.all([...disposers].map(async (dispose) => dispose()));
    },
    config: (_config, environment) => hostConfig(rsc, serverEntry, environment),
    configResolved: pinReactEnv,
    async configurePreviewServer(server) {
      // oxlint-disable-next-line rules/no-effect-runtime-run -- Vite invokes its native Promise setup hook outside Effect.
      const instance = await Effect.runPromise(previewMiddleware(server.config));
      return mount(server, instance, disposers);
    },
    async configureServer(server) {
      const load = devLoader(server, rsc);
      // oxlint-disable-next-line rules/no-effect-runtime-run -- Vite invokes its native Promise setup hook outside Effect.
      const instance = await Effect.runPromise(makeMiddleware(load));
      return mount(server, instance, disposers);
    },
    name: serverPluginName,
  };
};
