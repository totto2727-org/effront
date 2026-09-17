import { join, resolve } from "node:path";

import { normalizePath, type Plugin, type PluginOption } from "vite";

import { alchemyRuntimeProjection } from "./runtime-projection";

const entryId = "virtual:effront/alchemy/cloudflare/entry";
const resolvedEntryId = `\0${entryId}`;

export type EffrontAlchemyOptions = {
  /** Module default-exporting the native Alchemy Worker construct. Relative to the Vite root. Defaults to `./src/entry.workers.ts`. */
  readonly worker?: string;
};

/**
 * Configures Alchemy's native Worker bridge alongside the separate `effront()` integration.
 *
 * Declare the Worker directly with `vite: { viteEnvironments: { entry: "rsc",
 * children: ["ssr"] } }`. Alchemy CLI supplies its host plugin. Application
 * configs must not register another runtime host. Standalone acceptance tests
 * own their separate local workerd host.
 */
export const effrontAlchemy = (options: EffrontAlchemyOptions = {}): PluginOption[] => {
  const workerEntry = options.worker ?? "./src/entry.workers.ts";
  if (!workerEntry) throw new TypeError("Effront Alchemy requires a nonempty Worker module.");
  let worker = workerEntry;
  const ssrOutput: Plugin = {
    name: "effront:alchemy-cloudflare-ssr-output",
    config: {
      // Set the host default before RSC supplies its generic SSR output directory.
      order: "pre",
      handler: (config) => {
        if (config.environments?.["ssr"]?.build?.outDir !== undefined) return;
        const rscOutput =
          config.environments?.["rsc"]?.build?.outDir ??
          join(config.build?.outDir ?? "dist", "rsc");
        return { environments: { ssr: { build: { outDir: join(rscOutput, "ssr") } } } };
      },
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
          "Register effront() before effrontAlchemy() so the host receives the native Worker bridge.",
        );
      }
      worker = normalizePath(resolve(config.root, workerEntry));
    },
    resolveId: (id) => (id === entryId ? resolvedEntryId : undefined),
    load: (id) => {
      if (id !== resolvedEntryId) return;
      return [
        'import { env, WorkerEntrypoint } from "cloudflare:workers";',
        'import { makeWorkerBridge } from "alchemy/Cloudflare/Workers";',
        `import entrypoint from ${JSON.stringify(worker)};`,
        "const stack = { name: env.ALCHEMY_STACK_NAME, stage: env.ALCHEMY_STAGE };",
        'if (typeof stack.name !== "string" || !stack.name || typeof stack.stage !== "string" || !stack.stage) throw new TypeError("Effront requires Alchemy runtime stack bindings. Start the application with alchemy dev.");',
        "export default makeWorkerBridge(WorkerEntrypoint, { entrypoint, stack });",
      ].join("\n");
    },
  };

  return [ssrOutput, bridge, alchemyRuntimeProjection()];
};
