import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as Cloudflare from "alchemy/Cloudflare";
import { describe, expect, it } from "vite-plus/test";

import { alchemyRuntimeProjection } from "./runtime-projection";

describe("pinned Alchemy runtime export projection", () => {
  it("leaves the real Node-side construction provider exports available", () => {
    expect(Cloudflare.providers).toBeTypeOf("function");
    expect(Cloudflare.KV.NamespaceProvider).toBeTypeOf("function");
  });
  it("projects only supported native Worker and KV exports from real installed modules", () => {
    const root = dirname(dirname(fileURLToPath(import.meta.resolve("alchemy"))));
    const plugin = alchemyRuntimeProjection();
    const hook = plugin.load!;
    const load = typeof hook === "function" ? hook : hook.handler;
    for (const [directory, extension] of [
      ["lib", "js"],
      ["src", "ts"],
    ] as const) {
      const workers = Reflect.apply(load, {}, [
        join(root, directory, "Cloudflare", "Workers", `index.${extension}`),
      ]) as { code: string };
      expect(workers.code).toContain("makeWorkerBridge");
      expect(workers.code).toContain(`Workers/WorkerBridge.${extension}`);
      expect(workers.code).not.toContain("WorkerProvider");
      const kv = Reflect.apply(load, {}, [
        join(root, directory, "Cloudflare", "KV", `index.${extension}`),
      ]) as { code: string };
      expect(kv.code).toContain("ReadWriteNamespaceBinding");
      expect(kv.code).not.toContain("NamespaceProvider");
      expect(kv.code).not.toContain("ReadWriteNamespaceHttp");
    }
    expect(Reflect.apply(load, {}, ["/application/worker.ts"])).toBeUndefined();
  });
});
