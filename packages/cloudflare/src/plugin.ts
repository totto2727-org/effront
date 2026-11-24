// oxlint-disable-next-line rules/no-node-imports -- Vite expects a host filesystem path during synchronous configuration.
import path from "node:path";

import { cloudflare } from "@cloudflare/vite-plugin";
import type { Plugin, PluginOption, UserConfig } from "vite";

/** Options forwarded to `@cloudflare/vite-plugin`, apart from invariant RSC environment wiring. */
export type EffrontCloudflareOptions = Omit<
  NonNullable<Parameters<typeof cloudflare>[number]>,
  "viteEnvironment"
>;

const rscEnvironment = { childEnvironments: ["ssr"], name: "rsc" };

const nestedSsrOutput = (config: UserConfig): UserConfig => {
  const rootOutput = config.build?.outDir ?? "dist";
  const rscOutput = config.environments?.["rsc"]?.build?.outDir ?? path.join(rootOutput, "rsc");
  return { environments: { ssr: { build: { outDir: path.join(rscOutput, "ssr") } } } };
};

const ssrOutputNesting = (): Plugin => ({
  config: (config): UserConfig | undefined =>
    // oxlint-disable-next-line rules/force-predicate -- Vite's build-time plugin preserves explicit output paths without loading an Effect runtime.
    config.environments?.["ssr"]?.build?.outDir === undefined ? nestedSsrOutput(config) : undefined,
  enforce: "pre",
  name: "effront:cloudflare-ssr-output",
});

/**
 * Configures Cloudflare Workers integration for Effront.
 *
 * Register this alongside `effront()` so the core RSC, SSR, and browser environments remain portable.
 *
 * The Cloudflare Worker environment is always `rsc` with `ssr` as its child so React Server Components
 * execute in workerd. By default, SSR output is nested beneath the RSC Worker output, allowing
 * Wrangler to include it as a Worker module. An explicit SSR `build.outDir` is preserved.
 * Other Cloudflare plugin options are forwarded unchanged.
 * @param {EffrontCloudflareOptions} options - Options for the Cloudflare Vite plugin.
 * @returns {PluginOption[]} The Cloudflare plugins and their SSR output configuration.
 */
export const effrontCloudflare = (options: EffrontCloudflareOptions = {}): PluginOption[] => [
  ...cloudflare({ ...options, viteEnvironment: rscEnvironment }),
  ssrOutputNesting(),
];
