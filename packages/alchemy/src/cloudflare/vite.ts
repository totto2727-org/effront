// oxlint-disable-next-line rules/no-node-imports -- Vite's synchronous configuration resolves entry paths on the build host.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- The virtual loader must match the host filesystem path of the packaged module.
import { fileURLToPath } from "node:url";

import { normalizePath } from "vite";
import type { Plugin, PluginOption, UserConfig } from "vite";

import { alchemyRuntimeProjection } from "./runtime-projection.ts";

const entryId = "virtual:effront/alchemy/cloudflare/entry";
const resolvedEntryId = `\0${entryId}`;
const applicationLoader = fileURLToPath(new URL("application-loader", import.meta.url));
const missingPlugin = -1;
const applicationSource = [
  'import application from "@effront/core/application-entry";',
  "export const loadConfiguredApplication = () => Promise.resolve(application);",
].join("\n");

const nestedSsrOutput = (config: UserConfig): UserConfig => {
  const rscOutput =
    config.environments?.["rsc"]?.build?.outDir ?? path.join(config.build?.outDir ?? "dist", "rsc");
  return { environments: { ssr: { build: { outDir: path.join(rscOutput, "ssr") } } } };
};

const ssrOutputPlugin = (): Plugin => ({
  config: {
    // Set the host default before RSC supplies its generic SSR output directory.
    handler: (config): UserConfig | undefined =>
      // oxlint-disable-next-line rules/force-predicate -- The Vite configuration hook preserves explicit output paths without an Effect runtime.
      config.environments?.["ssr"]?.build?.outDir === undefined
        ? nestedSsrOutput(config)
        : undefined,
    order: "pre",
  },
  name: "effront:alchemy-cloudflare-ssr-output",
});

const applicationLoaderPlugin = (): Plugin => ({
  applyToEnvironment: (environment) => environment.name === "rsc",
  load: (id) =>
    id === `${applicationLoader}.js` || id === `${applicationLoader}.ts`
      ? applicationSource
      : undefined,
  name: "effront:alchemy-application-loader",
});

const bridgeSource = (worker: string): string =>
  [
    'import { env, WorkerEntrypoint } from "cloudflare:workers";',
    'import { makeWorkerBridge } from "alchemy/Cloudflare/Workers";',
    `import entrypoint from ${JSON.stringify(worker)};`,
    "const stack = { name: env.ALCHEMY_STACK_NAME, stage: env.ALCHEMY_STAGE };",
    'if (typeof stack.name !== "string" || !stack.name || typeof stack.stage !== "string" || !stack.stage) throw new TypeError("Effront requires Alchemy runtime stack bindings. Start the application with alchemy dev.");',
    "export default makeWorkerBridge(WorkerEntrypoint, { entrypoint, stack });",
  ].join("\n");

const workerBridgePlugin = (workerEntry: string): Plugin => {
  const worker = { path: workerEntry };
  const bridge: Plugin = {
    config: {
      // The host must see the bridge before it captures its Worker entry.
      handler: () => ({
        define: { "globalThis.__ALCHEMY_RUNTIME__": "true" },
        // oxlint-disable-next-line typescript/no-deprecated -- Keep the bridge input compatible with Rollup-based Vite consumers.
        environments: { rsc: { build: { rollupOptions: { input: { index: entryId } } } } },
        resolve: { dedupe: ["react", "react-dom", "effect"] },
      }),
    },
    configResolved: (config) => {
      const portableIndex = config.plugins.findIndex((plugin) => plugin.name === "rsc");
      const bridgeIndex = config.plugins.findIndex((plugin) => plugin.name === bridge.name);
      if (portableIndex !== missingPlugin && portableIndex > bridgeIndex) {
        // oxlint-disable-next-line rules/require-tagged-error -- Vite reports a synchronous TypeError for an invalid plugin registration order.
        throw new TypeError(
          "Register effront() before effrontAlchemy() so the host receives the native Worker bridge.",
        );
      }
      worker.path = normalizePath(path.resolve(config.root, workerEntry));
    },
    load: (id) => (id === resolvedEntryId ? bridgeSource(worker.path) : undefined),
    name: "effront:alchemy-cloudflare-bridge",
    resolveId: (id) => (id === entryId ? resolvedEntryId : undefined),
  };
  return bridge;
};

export type EffrontAlchemyOptions = Readonly<{
  /** Module default-exporting the native Alchemy Worker construct. Relative to the Vite root. Defaults to `./src/entry.workers.ts`. */
  worker?: string;
}>;

/**
 * Configures Alchemy's native Worker bridge alongside the separate `effront()` integration.
 *
 * Declare the Worker directly with `vite: { viteEnvironments: { entry: "rsc",
 * children: ["ssr"] } }`. Alchemy CLI supplies its host plugin. Application
 * configs must not register another runtime host. Standalone acceptance tests
 * own their separate local workerd host.
 * @param {EffrontAlchemyOptions} options - Optional Worker entry relative to the Vite root.
 * @returns {PluginOption[]} The Worker bridge, configured loader, and runtime compilation plugins.
 */
export const effrontAlchemy = (options: EffrontAlchemyOptions = {}): PluginOption[] => {
  const workerEntry = options.worker ?? "./src/entry.workers.ts";
  if (!workerEntry) {
    // oxlint-disable-next-line rules/require-tagged-error -- Invalid Worker options use a native TypeError before Vite starts.
    throw new TypeError("Effront Alchemy requires a nonempty Worker module.");
  }
  return [
    ssrOutputPlugin(),
    applicationLoaderPlugin(),
    workerBridgePlugin(workerEntry),
    alchemyRuntimeProjection(),
  ];
};
