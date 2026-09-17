import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { effront } from "@effront/vite";
import { normalizePath, resolveConfig } from "vite";
import { describe, expect, it } from "vite-plus/test";

import { effrontAlchemy } from "./vite";

const root = fileURLToPath(new URL("../../../../examples/alchemy/", import.meta.url));

describe("Alchemy Vite graph composition", () => {
  it("owns a native RSC bridge and runtime flag without installing a second host", async () => {
    const config = await resolveConfig(
      {
        configFile: false,
        root,
        plugins: [effront(), effrontAlchemy()],
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
    expect(source).toContain(JSON.stringify(normalizePath(resolve(root, "src/entry.workers.ts"))));
    expect(source).toContain("name: env.ALCHEMY_STACK_NAME");
    expect(source).toContain("stage: env.ALCHEMY_STAGE");
    expect(source).not.toContain("configuredStack");
    expect(source).toContain("Effront requires Alchemy runtime stack bindings");
    expect(source).not.toContain("async fetch");
  });

  it("leaves dependency optimization to the host and consumer", async () => {
    const config = await resolveConfig(
      {
        configFile: false,
        root,
        environments: {
          rsc: { optimizeDeps: { noDiscovery: true, include: ["consumer-dependency"] } },
          ssr: { optimizeDeps: { exclude: ["consumer-exclusion"] } },
        },
        plugins: [effront(), effrontAlchemy()],
      },
      "serve",
    );
    expect(config.environments["rsc"]?.optimizeDeps.noDiscovery).toBe(true);
    expect(config.environments["rsc"]?.optimizeDeps.include).toContain("consumer-dependency");
    expect(config.environments["ssr"]?.optimizeDeps.exclude).toContain("consumer-exclusion");
    const bridge = config.plugins.find(
      (plugin) => plugin.name === "effront:alchemy-cloudflare-bridge",
    )!;
    const hook = bridge.config!;
    const configure = typeof hook === "function" ? hook : hook.handler;
    const contribution = Reflect.apply(configure, {}, [{}]) as {
      environments: Record<string, object>;
    };
    for (const environment of Object.values(contribution.environments)) {
      expect(environment).not.toHaveProperty("optimizeDeps");
    }
  });

  it("provides the bridge before the real Cloudflare host captures its entry", async () => {
    const config = await resolveConfig(
      {
        configFile: fileURLToPath(
          new URL("../../../../tests/e2e-alchemy/vite.config.ts", import.meta.url),
        ),
      },
      "serve",
    );
    expect(JSON.stringify(config.environments["rsc"]?.build.rollupOptions.input)).toContain(
      "virtual:effront/alchemy/cloudflare/entry",
    );
  });

  it("keeps portable application configuration separate from the native worker", async () => {
    const config = await resolveConfig(
      {
        configFile: false,
        root,
        plugins: [
          effront({ application: "./client/application.ts" }),
          effrontAlchemy({ worker: "./src/worker.ts" }),
        ],
      },
      "build",
    );
    expect(config.resolve.alias).toContainEqual({
      find: "@effront/core/application-entry",
      replacement: resolve(root, "client/application.ts"),
    });
    const bridge = config.plugins.find(
      (plugin) => plugin.name === "effront:alchemy-cloudflare-bridge",
    )!;
    const hook = bridge.load!;
    const load = typeof hook === "function" ? hook : hook.handler;
    expect(Reflect.apply(load, {}, ["\0virtual:effront/alchemy/cloudflare/entry"])).toContain(
      JSON.stringify(normalizePath(resolve(root, "src/worker.ts"))),
    );
  });

  it("does not register the portable React or RSC integrations by itself", async () => {
    const config = await resolveConfig(
      { configFile: false, root, plugins: effrontAlchemy() },
      "build",
    );
    expect(config.plugins.map((plugin) => plugin.name)).not.toContain("effront:application-entry");
    expect(config.environments["rsc"]?.resolve.conditions).not.toContain("react-server");
    expect(config.resolve.alias).not.toContainEqual(
      expect.objectContaining({ find: "@effront/core/application-entry" }),
    );
  });

  it.each(["portable-first", "adapter-first"] as const)(
    "validates native bridge configuration in %s order",
    async (order) => {
      const portable = effront({ rsc: "./src/custom-fetch.ts" });
      const adapter = effrontAlchemy();
      const configuration = resolveConfig(
        {
          configFile: false,
          root,
          plugins: order === "portable-first" ? [portable, adapter] : [adapter, portable],
        },
        "build",
      );
      if (order === "adapter-first") {
        await expect(configuration).rejects.toThrow("Register effront() before effrontAlchemy()");
        return;
      }
      const config = await configuration;
      expect(config.environments["rsc"]?.build.rollupOptions.input).toEqual({
        index: "virtual:effront/alchemy/cloudflare/entry",
      });
      expect(
        config.plugins.filter((plugin) => plugin.name === "effront:application-entry"),
      ).toHaveLength(1);
      expect(config.environments["rsc"]?.resolve.conditions).toContain("react-server");
      expect(config.environments["ssr"]?.build.outDir).toBe(resolve(root, "dist/rsc/ssr"));
    },
  );

  it("rejects an empty explicit worker entry", () => {
    expect(() => effrontAlchemy({ worker: "" })).toThrow(TypeError);
  });

  it("nests SSR below an explicitly configured RSC output", async () => {
    const config = await resolveConfig(
      {
        configFile: false,
        root,
        environments: { rsc: { build: { outDir: "custom/worker" } } },
        plugins: [effront(), effrontAlchemy({ worker: "./src/worker.ts" })],
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
        plugins: [effront(), effrontAlchemy({ worker: "./src/worker.ts" })],
      },
      "build",
    );
    expect(config.environments["ssr"]?.build.outDir).toBe(resolve(root, "custom/server-renderer"));
  });
});
