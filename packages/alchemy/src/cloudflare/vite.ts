import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { EffrontViteConfig } from "@effront/vite";
import { normalizePath, type Plugin, type PluginOption } from "vite";

import { alchemyRuntimeProjection } from "./runtime-projection";
import { validateWorkerName, workerBinding } from "./worker-options";

const entryId = "virtual:effront/alchemy/cloudflare/entry";
const resolvedEntryId = `\0${entryId}`;
const applicationLoader = fileURLToPath(new URL("./application-loader", import.meta.url));

export type EffrontAlchemyOptions = {
  /** Module with named Alchemy Worker exports. Relative to the Vite root. */
  readonly workers: string;
};

const selectedWorker = (config: EffrontViteConfig) => {
  // Alchemy forwards Worker env values prefixed with VITE_ as Vite defines in dev and build.
  const binding = config.define?.[`import.meta.env.${workerBinding}`];
  if (binding === undefined) {
    throw new TypeError("Effront Alchemy requires effrontWorkerOptions(name) on each Worker.");
  }
  let name: unknown;
  try {
    if (typeof binding === "string") name = JSON.parse(binding);
  } catch {
    throw new TypeError(`Invalid Vite define for ${workerBinding}.`);
  }
  return validateWorkerName(name);
};

/**
 * Configures Alchemy's native Worker bridge alongside the separate `effront()` integration.
 *
 * Export each native Worker by name and pass `effrontWorkerOptions(name)` to
 * its declaration. Alchemy CLI supplies its host plugin. Application
 * configs must not register another runtime host. Standalone acceptance tests
 * own their separate local workerd host.
 */
export const effrontAlchemy = ({ workers }: EffrontAlchemyOptions): PluginOption[] => {
  if (!workers) throw new TypeError("Effront Alchemy requires a nonempty Workers module path.");
  let workerName: string;
  let entrypointImport: string;
  const outputs: Plugin = {
    name: "effront:alchemy-cloudflare-graphs",
    config: {
      // Configure the selected Worker before Effront binds the application alias and RSC supplies its defaults.
      order: "pre",
      handler: (config): EffrontViteConfig => {
        workerName = selectedWorker(config);
        const { environments } = config;
        if (
          ["client", "rsc", "ssr"].some((env) => environments?.[env]?.build?.outDir !== undefined)
        ) {
          throw new TypeError(
            "Set build.outDir instead of per-environment Effront Worker output directories.",
          );
        }
        const output = join(config.build?.outDir ?? "dist", workerName);
        return {
          effrontWorker: workerName,
          cacheDir: join(config.cacheDir ?? "node_modules/.vite", "effront", workerName),
          environments: {
            client: { build: { outDir: join(output, "client") } },
            rsc: { build: { outDir: join(output, "rsc") } },
            ssr: { build: { outDir: join(output, "rsc", "ssr") } },
          },
        };
      },
    },
  };
  const application: Plugin = {
    name: "effront:alchemy-application-loader",
    applyToEnvironment: (environment) => environment.name === "rsc",
    load(id) {
      if (id !== `${applicationLoader}.js` && id !== `${applicationLoader}.ts`) return;
      return [
        'import { Effect } from "effect";',
        'import application from "@effront/core/application-entry";',
        "export const loadConfiguredApplication = Effect.succeed(application);",
      ].join("\n");
    },
  };
  const bridge: Plugin = {
    name: "effront:alchemy-cloudflare-bridge",
    config: {
      // The host must see the bridge before it captures its Worker entry.
      handler: () => ({
        define: { "globalThis.__ALCHEMY_RUNTIME__": "true" },
        resolve: { dedupe: ["react", "react-dom", "effect"] },
        environments: { rsc: { build: { rollupOptions: { input: { index: entryId } } } } },
      }),
    },
    configResolved: (config) => {
      const portableIndex = config.plugins.findIndex((plugin) => plugin.name === "rsc");
      const bridgeIndex = config.plugins.findIndex((plugin) => plugin.name === bridge.name);
      if (portableIndex !== -1 && portableIndex > bridgeIndex) {
        throw new TypeError(
          "Register effront before effrontAlchemy so the host receives the native Worker bridge.",
        );
      }
      const module = JSON.stringify(normalizePath(resolve(config.root, workers)));
      entrypointImport = `import { ${workerName} as entrypoint } from ${module};`;
    },
    resolveId: (id) => (id === entryId ? resolvedEntryId : undefined),
    load: (id) => {
      if (id !== resolvedEntryId) return;
      return [
        'import "effect/schema/SchemaJITCompiler/enable";',
        'import { env, WorkerEntrypoint } from "cloudflare:workers";',
        'import { makeWorkerBridge } from "alchemy/Cloudflare/Workers";',
        entrypointImport,
        "const stack = { name: env.ALCHEMY_STACK_NAME, stage: env.ALCHEMY_STAGE };",
        'if (typeof stack.name !== "string" || !stack.name || typeof stack.stage !== "string" || !stack.stage) throw new TypeError("Effront requires Alchemy runtime stack bindings. Start the application with alchemy dev.");',
        "export default makeWorkerBridge(WorkerEntrypoint, { entrypoint, stack });",
      ].join("\n");
    },
  };

  return [outputs, application, bridge, alchemyRuntimeProjection()];
};
