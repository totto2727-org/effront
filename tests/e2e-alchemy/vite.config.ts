// oxlint-disable-next-line rules/no-node-imports -- The local Worker host config resolves physical Vite paths on Node.
import { fileURLToPath } from "node:url";
import * as KvNamespace from "@alchemy.run/cloudflare-runtime/core/bindings/kv-namespace/KvNamespace";
import cloudflare from "@alchemy.run/cloudflare-runtime/vite";
import { defineConfig } from "vite-plus";
// oxlint-disable-next-line import/no-relative-parent-imports -- This host builds the actual example and uses its declared Vite plugins.
import application from "../../examples/basic/vite.config";
import * as Text from "@alchemy.run/cloudflare-runtime/core/bindings/Text";

// Test-only local host. Applications rely on Alchemy CLI to construct and inject their host.
// oxlint-disable-next-line import/no-default-export -- Vite reads the host configuration through its default export.
export default defineConfig({
  ...application,
  plugins: [
    application.plugins,
    cloudflare({
      compatibilityDate: "2026-09-01",
      compatibilityFlags: ["nodejs_compat"],
      viteEnvironments: { children: ["ssr"], entry: "rsc" },
      worker: {
        bindings: [
          Text.local("ALCHEMY_STACK_NAME", "effront-alchemy-example"),
          Text.local("ALCHEMY_STAGE", "test"),
          KvNamespace.local({ binding: "Cache", id: "effront-example-cache" }),
        ],
        name: "effront-alchemy-example",
      },
    }),
  ],
  root: fileURLToPath(new URL("../../examples/basic/", import.meta.url)),
});
