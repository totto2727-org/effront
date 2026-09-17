import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizePath, resolveConfig } from "vite";
import { describe, expect, it } from "vite-plus/test";

import { effrontAlchemy } from "./vite";

const root = fileURLToPath(new URL("../../../../examples/workers/", import.meta.url));

describe("Alchemy Vite graph composition", () => {
  it("owns a native RSC bridge and runtime flag without installing a second host", async () => {
    const stack = { name: "example", stage: "local" };
    const config = await resolveConfig(
      {
        configFile: false,
        root,
        plugins: effrontAlchemy({ worker: "./src/worker.ts", stack }),
      },
      "build",
    );
    expect(config.define?.["globalThis.__ALCHEMY_RUNTIME__"]).toBe("true");
    expect(Object.keys(config.environments)).toEqual(
      expect.arrayContaining(["rsc", "ssr", "client"]),
    );
    expect(config.environments["rsc"]?.build.rollupOptions.input).toEqual({
      index: "virtual:effront/alchemy/cloudflare/entry",
    });
    expect(config.environments["ssr"]?.build.outDir).toBe(resolve(root, "dist/rsc/ssr"));
    expect(config.environments["rsc"]?.resolve.conditions).toContain("react-server");
    expect(config.environments["ssr"]?.resolve.conditions).not.toContain("react-server");
    expect(config.environments["client"]?.resolve.conditions).not.toContain("react-server");
    expect(config.plugins.some((plugin) => plugin.name.startsWith("cloudflare:"))).toBe(false);

    const bridge = config.plugins.find(
      (plugin) => plugin.name === "effront:alchemy-cloudflare-bridge",
    )!;
    const resolveHook = bridge.resolveId!;
    const loadHook = bridge.load!;
    const resolveEntry = typeof resolveHook === "function" ? resolveHook : resolveHook.handler;
    const loadEntry = typeof loadHook === "function" ? loadHook : loadHook.handler;
    const id = Reflect.apply(resolveEntry, {}, ["virtual:effront/alchemy/cloudflare/entry"]);
    const source = Reflect.apply(loadEntry, {}, [id]) as string;
    expect(source).toContain('import { env, WorkerEntrypoint } from "cloudflare:workers"');
    expect(source).toContain('"alchemy/Cloudflare/Workers"');
    expect(source).toContain(JSON.stringify(normalizePath(resolve(root, "src/worker.ts"))));
    expect(source).toContain(JSON.stringify(stack));
    expect(source).toContain("env.ALCHEMY_STACK_NAME ?? configuredStack.name");
    expect(source).toContain("env.ALCHEMY_STAGE ?? configuredStack.stage");
    expect(source).not.toContain("async fetch");
  });

  it("keeps an explicit client application entry separate from the native worker", async () => {
    const config = await resolveConfig(
      {
        configFile: false,
        root,
        plugins: effrontAlchemy({
          worker: "./src/worker.ts",
          stack: { name: "example", stage: "test" },
          application: "./client/application.ts",
        }),
      },
      "build",
    );
    expect(config.resolve.alias).toContainEqual({
      find: "@effront/core/application-entry",
      replacement: resolve(root, "client/application.ts"),
    });
  });

  it("rejects incomplete stack identity", () => {
    expect(() =>
      effrontAlchemy({ worker: "./worker.ts", stack: { name: "example", stage: "" } }),
    ).toThrow(TypeError);
  });

  it("nests SSR below an explicitly configured RSC output", async () => {
    const config = await resolveConfig(
      {
        configFile: false,
        root,
        environments: { rsc: { build: { outDir: "custom/worker" } } },
        plugins: effrontAlchemy({
          worker: "./src/worker.ts",
          stack: { name: "example", stage: "local" },
        }),
      },
      "build",
    );
    expect(config.environments["ssr"]?.build.outDir).toBe(resolve(root, "custom/worker/ssr"));
  });

  it("preserves an explicitly configured SSR output directory", async () => {
    const config = await resolveConfig(
      {
        configFile: false,
        root,
        environments: { ssr: { build: { outDir: "custom/server-renderer" } } },
        plugins: effrontAlchemy({
          worker: "./src/worker.ts",
          stack: { name: "example", stage: "local" },
        }),
      },
      "build",
    );
    expect(config.environments["ssr"]?.build.outDir).toBe(resolve(root, "custom/server-renderer"));
  });
});
