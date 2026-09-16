import * as KvNamespace from "@alchemy.run/cloudflare-runtime/core/bindings/kv-namespace/KvNamespace";
import cloudflare from "@alchemy.run/cloudflare-runtime/vite";
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { defineConfig } from "vite-plus";
import { stack } from "./stack";

export default defineConfig({
  plugins: [
    effrontAlchemy({ worker: "./src/entry.workers.ts", stack }),
    process.env["ALCHEMY_CLOUDFLARE_VITE_INJECTED"] === "1"
      ? []
      : cloudflare({
          compatibilityDate: "2026-09-01",
          // Local-only simulator for direct Vite. Alchemy CLI supplies its constructed bindings instead.
          worker: {
            name: stack.name,
            bindings: [KvNamespace.local({ binding: "Cache", id: "effront-example-cache" })],
          },
          compatibilityFlags: ["nodejs_compat"],
          viteEnvironments: { entry: "rsc", children: ["ssr"] },
        }),
  ],
  // Explicit so the example keeps its lint setup when used outside this workspace.
  lint: {
    plugins: ["eslint", "typescript", "unicorn", "oxc", "react"],
    options: { typeAware: true, typeCheck: true },
  },
});
