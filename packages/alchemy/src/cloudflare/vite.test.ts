import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveConfig } from "vite";
import { describe, expect, it } from "vite-plus/test";

import { effrontAlchemy } from "./vite";

const root = fileURLToPath(new URL("../../../../examples/workers/", import.meta.url));

describe("Alchemy Website Vite graph composition", () => {
  it("uses an independent runtime entry without installing a second host", async () => {
    const config = await resolveConfig(
      { configFile: false, root, plugins: effrontAlchemy() },
      "build",
    );
    expect(Object.keys(config.environments)).toEqual(
      expect.arrayContaining(["rsc", "ssr", "client"]),
    );
    expect(config.environments["rsc"]?.build.rollupOptions.input).toEqual({
      index: "./src/entry.workers.ts",
    });
    expect(config.environments["ssr"]?.build.outDir).toBe(resolve(root, "dist/rsc/ssr"));
    expect(config.environments["rsc"]?.resolve.conditions).toContain("react-server");
    expect(config.environments["ssr"]?.resolve.conditions).not.toContain("react-server");
    expect(config.environments["client"]?.resolve.conditions).not.toContain("react-server");
    expect(config.plugins.some((plugin) => plugin.name.startsWith("cloudflare:"))).toBe(false);
    expect(config.define?.["globalThis.__ALCHEMY_RUNTIME__"]).toBeUndefined();
  });

  it("keeps explicit runtime and browser application entries separate", async () => {
    const config = await resolveConfig(
      {
        configFile: false,
        root,
        plugins: effrontAlchemy({
          rsc: "./runtime/worker.ts",
          application: "./client/application.ts",
        }),
      },
      "build",
    );
    expect(config.environments["rsc"]?.build.rollupOptions.input).toEqual({
      index: "./runtime/worker.ts",
    });
    expect(config.resolve.alias).toContainEqual({
      find: "@effront/core/application-entry",
      replacement: resolve(root, "client/application.ts"),
    });
  });

  it("preserves an explicitly configured SSR output directory", async () => {
    const config = await resolveConfig(
      {
        configFile: false,
        root,
        environments: { ssr: { build: { outDir: "custom/server-renderer" } } },
        plugins: effrontAlchemy(),
      },
      "build",
    );
    expect(config.environments["ssr"]?.build.outDir).toBe(resolve(root, "custom/server-renderer"));
  });

  it("nests SSR below an explicitly configured RSC output", async () => {
    const config = await resolveConfig(
      {
        configFile: false,
        root,
        environments: { rsc: { build: { outDir: "custom/worker" } } },
        plugins: effrontAlchemy(),
      },
      "build",
    );
    expect(config.environments["ssr"]?.build.outDir).toBe(resolve(root, "custom/worker/ssr"));
  });
});
