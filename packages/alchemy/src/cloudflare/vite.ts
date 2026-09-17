import { join, resolve } from "node:path";

import { effront } from "@effront/vite";
import { purePlugin } from "alchemy/Bundle/PurePlugin";
import { normalizePath, type Plugin, type PluginOption } from "vite";

import { alchemyRuntimeProjection } from "./runtime-projection";

const entryId = "virtual:effront/alchemy/cloudflare/entry";
const resolvedEntryId = `\0${entryId}`;

export type EffrontAlchemyOptions = {
  /** Module default-exporting the native Alchemy Worker construct. Relative to the Vite root. */
  readonly worker: string;
  /** Standalone local identity. Alchemy's injected runtime stack bindings take precedence. */
  readonly stack: { readonly name: string; readonly stage: string };
  /** Browser-safe application definition entry used by Effront's client graph. */
  readonly application?: string;
};

/**
 * Composes Effront's RSC, SSR, and browser graphs with Alchemy's native Worker bridge.
 *
 * Declare the Worker directly with `vite: { viteEnvironments: { entry: "rsc",
 * children: ["ssr"] } }`. Alchemy CLI supplies its host plugin. Application
 * configs must not register another runtime host. Standalone acceptance tests
 * own their separate local workerd host.
 */
export const effrontAlchemy = (options: EffrontAlchemyOptions): PluginOption[] => {
  if (!options.worker || !options.stack.name || !options.stack.stage) {
    throw new TypeError("Effront Alchemy requires a Worker module and a stack name and stage.");
  }
  let worker = options.worker;
  const optimizeDeps = () => ({
    rolldownOptions: {
      transform: { define: { "globalThis.__ALCHEMY_RUNTIME__": "true" } },
      plugins: [alchemyRuntimeProjection(), purePlugin()],
    },
  });
  const bridge: Plugin = {
    name: "effront:alchemy-cloudflare-bridge",
    config: (config) => ({
      define: { "globalThis.__ALCHEMY_RUNTIME__": "true" },
      resolve: { dedupe: ["react", "react-dom", "effect"] },
      environments: {
        rsc: {
          optimizeDeps: {
            ...optimizeDeps(),
            entries: [options.worker],
            include: [
              "alchemy/Cloudflare",
              "alchemy/Cloudflare/Workers",
              "alchemy/Cloudflare/KV",
              "alchemy/RuntimeContext",
              "alchemy/Self",
              "effect",
              "effect/unstable/http",
              "alchemy > @effect/platform-node > @effect/platform-node-shared/NodePath",
            ],
          },
        },
        ssr: {
          optimizeDeps: optimizeDeps(),
          ...(config.environments?.["ssr"]?.build?.outDir === undefined
            ? {
                build: {
                  outDir: join(
                    config.environments?.["rsc"]?.build?.outDir ??
                      join(config.build?.outDir ?? "dist", "rsc"),
                    "ssr",
                  ),
                },
              }
            : {}),
        },
      },
    }),
    configResolved: (config) => {
      worker = normalizePath(resolve(config.root, options.worker));
    },
    resolveId: (id) => (id === entryId ? resolvedEntryId : undefined),
    load: (id) => {
      if (id !== resolvedEntryId) return;
      return [
        'import { env, WorkerEntrypoint } from "cloudflare:workers";',
        'import { makeWorkerBridge } from "alchemy/Cloudflare/Workers";',
        `import entrypoint from ${JSON.stringify(worker)};`,
        `const configuredStack = ${JSON.stringify(options.stack)};`,
        "const stack = { name: env.ALCHEMY_STACK_NAME ?? configuredStack.name, stage: env.ALCHEMY_STAGE ?? configuredStack.stage };",
        "export default makeWorkerBridge(WorkerEntrypoint, { entrypoint, stack });",
      ].join("\n");
    },
  };

  return [
    bridge,
    ...effront({
      rsc: entryId,
      ...(options.application === undefined ? {} : { application: options.application }),
    }),
  ];
};
