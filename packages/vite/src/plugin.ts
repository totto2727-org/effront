// oxlint-disable-next-line rules/no-node-imports -- Vite resolves compiler entries against the host filesystem during configuration.
import path from "node:path";
// oxlint-disable-next-line rules/no-node-imports -- The browser and SSR entry URLs become filesystem paths for Vite.
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import rsc from "@vitejs/plugin-rsc";
import type {
  EnvironmentModuleGraph,
  EnvironmentModuleNode,
  HotUpdateOptions,
  Plugin,
  PluginOption,
  UserConfig,
} from "vite";

const browserEntry = fileURLToPath(new URL("browser.js", import.meta.url));

const rawQuery = /[?&]raw(?:&|$)/u;
const emptyImporters = 0;
const pathPart = 1;

const isRawModuleFor = (module: EnvironmentModuleNode, file: string): boolean =>
  module.file === file && rawQuery.test(module.id ?? "");

const refreshRawImporters = (
  graph: EnvironmentModuleGraph,
  { file, modules, timestamp }: HotUpdateOptions,
): EnvironmentModuleNode[] => {
  const updates = new Set(modules.filter((module) => module.file !== file));
  const invalidated = new Set<EnvironmentModuleNode>();
  modules.forEach((module) => {
    if (module.file === file) {
      module.importers.forEach((importer) => {
        if (importer.file !== file) {
          updates.add(importer);
        }
      });
      graph.invalidateModule(module, invalidated, timestamp, true);
    }
  });
  return [...updates];
};

const rawAssetUpdates = (): Plugin => {
  const transformed = new WeakSet<EnvironmentModuleNode>();
  return {
    apply: "serve",
    applyToEnvironment: (environment) => environment.name === "rsc",
    hotUpdate: {
      handler(update) {
        const { file, modules, type } = update;
        if (type === "delete" && modules.some((module) => isRawModuleFor(module, file))) {
          // Refresh the live importers so the native glob enumerates the remaining files.
          return refreshRawImporters(this.environment.moduleGraph, update);
        }
        // Vite watches the queryless file when a raw import points to it.
        // Keep real raw imports and any queryless module that Vite transformed as JavaScript.
        return modules.filter(
          (module) =>
            module.id !== file ||
            transformed.has(module) ||
            module.importers.size === emptyImporters ||
            ![...module.importers].every((importer) => isRawModuleFor(importer, file)),
        );
      },
      order: "pre",
    },
    name: "effront:rsc-raw-assets",
    transform(_code, id) {
      if (this.environment.mode !== "dev") {
        return;
      }
      const module = this.environment.moduleGraph.getModuleById(id);
      if (module) {
        transformed.add(module);
      }
    },
  };
};

export type EffrontViteOptions = Readonly<{
  /** RSC environment entry exporting the runtime's `{ fetch }` handler; defaults to `src/entry.workers.ts`. */
  rsc?: string;
  /** Application definition export available as `@effront/core/application-entry`; defaults to `src/entry.effront.tsx`. */
  application?: string;
}>;

/**
 * Configures EFFRONT's RSC, SSR, and browser environments.
 *
 * This integration owns the RSC and React plugins. Consumers should only add their runtime plugin,
 * such as `@cloudflare/vite-plugin`, and must not register either React plugin a second time.
 * @param {EffrontViteOptions} options - Optional host and application entry paths.
 * @returns {PluginOption[]} The compiler plugins and entry configuration.
 */
export const effront = (options: EffrontViteOptions = {}): PluginOption[] => {
  const rscEntry = options.rsc ?? "./src/entry.workers.ts";
  const application = options.application ?? "./src/entry.effront.tsx";
  const entry: { resolved?: string } = {};
  const schemaJit: Plugin = {
    configResolved(config) {
      entry.resolved = path.resolve(config.root, rscEntry);
    },
    enforce: "pre",
    name: "effront:schema-jit",
    transform(code, id) {
      const [moduleId] = id.split("?", pathPart);
      // Register the compiler before the application module constructs or captures parsers.
      return this.environment.name === "rsc" && moduleId === entry.resolved
        ? `import "effect/schema/SchemaJITCompiler/enable";\n${code}`
        : undefined;
    },
  };
  const applicationAlias: Plugin = {
    config: (config): UserConfig => ({
      resolve: {
        alias: {
          "@effront/core/application-entry": path.resolve(
            config.root ?? process.cwd(),
            application,
          ),
        },
      },
    }),
    name: "effront:application-entry",
  };

  return [
    schemaJit,
    rawAssetUpdates(),
    react({ compiler: true }),
    rsc({
      entries: {
        client: browserEntry,
        rsc: rscEntry,
        ssr: fileURLToPath(import.meta.resolve("@effront/core/internal/ssr-entry")),
      },
      serverHandler: false,
    }),
    applicationAlias,
  ];
};
