import { join } from "node:path";

import { effront, type EffrontViteOptions } from "@effront/vite";
import type { Plugin, PluginOption } from "vite";

/** Independent runtime and browser entries, resolved by Vite rather than Alchemy infrastructure. */
export type EffrontAlchemyOptions = EffrontViteOptions;

/**
 * Composes Effront's graphs for Cloudflare.Website.Vite.
 *
 * Alchemy CLI injects the host with entry "rsc" and child "ssr". This plugin
 * nests the SSR output within the Worker artifact, without installing another
 * host or importing the infrastructure into the runtime graph.
 */
export const effrontAlchemy = (options: EffrontAlchemyOptions = {}): PluginOption[] => {
  const output: Plugin = {
    name: "effront:alchemy-cloudflare-output",
    enforce: "pre",
    config: (config) => {
      if (config.environments?.["ssr"]?.build?.outDir !== undefined) return;
      const rscOutput =
        config.environments?.["rsc"]?.build?.outDir ?? join(config.build?.outDir ?? "dist", "rsc");
      return { environments: { ssr: { build: { outDir: join(rscOutput, "ssr") } } } };
    },
  };
  return [output, ...effront(options)];
};
