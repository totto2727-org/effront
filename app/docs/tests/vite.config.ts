// oxlint-disable-next-line rules/no-node-imports -- The local Worker host config resolves physical Vite paths on Node.
import { fileURLToPath } from "node:url";
import cloudflare from "@alchemy.run/cloudflare-runtime/vite";
import * as Text from "@alchemy.run/cloudflare-runtime/core/bindings/Text";
import { defineConfig } from "vite-plus";
import application from "#docs-vite-config";

// Build the site and its plugins through a local Worker host independent of Alchemy deployment.
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
          Text.local("ALCHEMY_STACK_NAME", "effront-docs-acceptance"),
          Text.local("ALCHEMY_STAGE", "test"),
        ],
        name: "effront-docs-acceptance",
      },
    }),
  ],
  root: fileURLToPath(new URL("../", import.meta.url)),
});
