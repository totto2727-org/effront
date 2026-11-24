// oxlint-disable-next-line rules/no-node-imports -- Vite's configuration tests resolve a fixture on the current host.
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line rules/no-node-imports -- Expected build outputs use the host filesystem's path separator.
import path from "node:path";

import { describe, expect, test } from "vitest";
import { resolveConfig } from "vite";
import type { ResolvedConfig, UserConfig } from "vite";

import { effrontCloudflare } from "@effront/cloudflare";
import { effront } from "@effront/vite";

const fixtureRoot = fileURLToPath(new URL("fixtures/", import.meta.url));
const configPath = fileURLToPath(new URL("fixtures/wrangler.json", import.meta.url));

const resolveViteConfig = async (config: UserConfig): Promise<ResolvedConfig> =>
  resolveConfig(
    {
      root: fixtureRoot,
      ...config,
    },
    "build",
    "production",
  );

const resolveCloudflareConfig = async (config: UserConfig = {}): Promise<ResolvedConfig> =>
  resolveViteConfig({
    ...config,
    plugins: [effront(), effrontCloudflare({ configPath })],
  });

describe("cloudflare worker output", () => {
  test("resolves the invariant Cloudflare RSC environment with nested default SSR output", async () => {
    const config = await resolveCloudflareConfig();

    expect(config.environments["rsc"]).toBeDefined();
    expect(config.environments["ssr"]?.build.outDir).toBe(path.join(fixtureRoot, "dist/rsc/ssr"));
  });

  test("nests default SSR output under root and RSC output overrides", async () => {
    const rootOverride = await resolveCloudflareConfig({ build: { outDir: "worker-output" } });
    expect(rootOverride.environments["ssr"]?.build.outDir).toBe(
      path.join(fixtureRoot, "worker-output/rsc/ssr"),
    );

    const rscOverride = await resolveCloudflareConfig({
      build: { outDir: "worker-output" },
      environments: { rsc: { build: { outDir: "custom-rsc" } } },
    });
    expect(rscOverride.environments["ssr"]?.build.outDir).toBe(
      path.join(fixtureRoot, "custom-rsc/ssr"),
    );
  });

  test("preserves an explicit SSR output override", async () => {
    const config = await resolveCloudflareConfig({
      environments: { ssr: { build: { outDir: "custom-ssr" } } },
    });

    expect(config.environments["ssr"]?.build.outDir).toBe(path.join(fixtureRoot, "custom-ssr"));
  });
});

describe("cloudflare and portable core plugin composition", () => {
  test("registers the portable core exactly once alongside Cloudflare", async () => {
    const config = await resolveCloudflareConfig();
    const names = config.plugins.map(({ name }) => name);

    expect(names).toContain("vite-plugin-cloudflare");
    expect(names).toContain("effront:cloudflare-ssr-output");
    expect(names.filter((name) => name === "effront:application-entry")).toHaveLength(1);
  });

  test("keeps the core-only resolved Vite configuration free of Cloudflare plugins", async () => {
    const config = await resolveViteConfig({ plugins: effront() });
    const names = config.plugins.map(({ name }) => name);

    expect(names).toContain("effront:application-entry");
    expect(names).not.toContain("vite-plugin-cloudflare");
    expect(names).not.toContain("effront:cloudflare-ssr-output");
  });

  test("keeps the Cloudflare-only resolved Vite configuration free of portable core plugins", async () => {
    const config = await resolveViteConfig({ plugins: effrontCloudflare({ configPath }) });
    const names = config.plugins.map(({ name }) => name);

    expect(names).toContain("vite-plugin-cloudflare");
    expect(names).toContain("effront:cloudflare-ssr-output");
    expect(names).not.toContain("effront:application-entry");
  });
});
