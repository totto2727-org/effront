import * as Cloudflare from "alchemy/Cloudflare";
import { describe, expect, it } from "vite-plus/test";

import { alchemyRuntimeProjection } from "./runtime-projection";

const hooks = () => {
  const plugin = alchemyRuntimeProjection();
  const resolveHook = plugin.resolveId!;
  const loadHook = plugin.load!;
  const resolve = typeof resolveHook === "function" ? resolveHook : resolveHook.handler;
  const load = typeof loadHook === "function" ? loadHook : loadHook.handler;
  return {
    plugin,
    resolve: (id: string) => Reflect.apply(resolve, {}, [id]) as string | undefined,
    load: (id: string) => Reflect.apply(load, {}, [id]) as Promise<string> | undefined,
  };
};

const exportsOf = (code: string) => {
  const clause = code.match(/export \{([^}]+)\};\s*$/)?.[1];
  if (!clause) throw new TypeError("Expected an ES module export clause.");
  return clause.split(",").map((entry) =>
    entry
      .trim()
      .split(/\s+as\s+/)
      .at(-1),
  );
};

describe("subtractive Alchemy development compatibility", () => {
  it("leaves deployment exports available to the real Node tooling", () => {
    expect(Cloudflare.providers).toBeTypeOf("function");
    expect(Cloudflare.KV.NamespaceProvider).toBeTypeOf("function");
  });

  it("keeps non-KV capabilities and runtime providers while removing deployment code", async () => {
    const { resolve, load } = hooks();
    const id = resolve("alchemy/Cloudflare")!;
    const first = load(id)!;
    expect(load(id)).toBe(first);
    const code = await first;
    const names = exportsOf(code);
    expect(names).toEqual(
      expect.arrayContaining([
        "Worker",
        "KV",
        "R2",
        "D1",
        "Queues",
        "Workflows",
        "Vectorize",
        "AI",
        "WorkerConfigProvider",
        "BrowserLocal",
        "makeWorkerBridge",
      ]),
    );
    expect(names).not.toContain("providers");
    expect(names).not.toContain("ContainerProvider");
    expect(code).not.toContain("downloadedBinPath");
    expect(code).not.toContain("import.meta.resolve");
  }, 30000);

  it("preserves R2 runtime and HTTP APIs without enumerating allowed capabilities", async () => {
    const { resolve, load } = hooks();
    const code = await load(resolve("alchemy/Cloudflare/R2")!)!;
    const names = exportsOf(code);
    expect(names).toEqual(
      expect.arrayContaining([
        "Bucket",
        "ReadWriteBucket",
        "ReadWriteBucketBinding",
        "ReadWriteBucketHttp",
      ]),
    );
    expect(names).not.toContain("BucketProvider");
    expect(names).not.toContain("ProviderLocal");
  }, 30000);

  it("runs only in server development and never contributes optimizer configuration", () => {
    const { plugin, resolve, load } = hooks();
    expect(plugin.apply).toBe("serve");
    expect(plugin.config).toBeUndefined();
    expect(plugin.configEnvironment).toBeUndefined();
    expect(Reflect.apply(plugin.applyToEnvironment!, {}, [{ name: "client" }])).toBe(false);
    expect(Reflect.apply(plugin.applyToEnvironment!, {}, [{ name: "rsc" }])).toBe(true);
    expect(Reflect.apply(plugin.applyToEnvironment!, {}, [{ name: "ssr" }])).toBe(true);
    expect(resolve("other-package")).toBeUndefined();
    expect(load("/application/worker.ts")).toBeUndefined();
    expect(() => resolve("alchemy/Cloudflare/StateStore")).toThrow("deployment-only");
  });
});
