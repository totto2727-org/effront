import { fileURLToPath } from "node:url";
import * as KvNamespace from "@alchemy.run/cloudflare-runtime/core/bindings/kv-namespace/KvNamespace";
import * as Text from "@alchemy.run/cloudflare-runtime/core/bindings/Text";
import cloudflare from "@alchemy.run/cloudflare-runtime/vite";
import { defineConfig } from "vite-plus";
import application from "../../examples/alchemy/vite.config";

// Test-only workerd development host. The committed example remains owned by Alchemy CLI configuration.
export default defineConfig({
  ...application,
  root: fileURLToPath(new URL("../../examples/alchemy/", import.meta.url)),
  cacheDir: fileURLToPath(new URL("./.vite-cache", import.meta.url)),
  plugins: [
    application.plugins,
    cloudflare({
      compatibilityDate: "2026-09-01",
      compatibilityFlags: ["nodejs_compat"],
      viteEnvironments: { entry: "rsc", children: ["ssr"] },
      worker: {
        name: "effront-alchemy-example-dev",
        bindings: [
          Text.local("ALCHEMY_STACK_NAME", "effront-alchemy-example-dev"),
          Text.local("ALCHEMY_STAGE", "test"),
          KvNamespace.local({ binding: "Cache", id: "effront-example-dev-cache" }),
        ],
      },
    }),
  ],
});
