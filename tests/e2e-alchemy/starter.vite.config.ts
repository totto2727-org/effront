// oxlint-disable-next-line rules/no-node-imports -- The local Worker host config resolves physical Vite paths on Node.
import { fileURLToPath } from "node:url";
import * as Text from "@alchemy.run/cloudflare-runtime/core/bindings/Text";
import cloudflare from "@alchemy.run/cloudflare-runtime/vite";
import { defineConfig } from "vite-plus";
// oxlint-disable-next-line import/no-relative-parent-imports -- This host builds the actual example and uses its declared Vite plugins.
import application from "../../examples/alchemy-cloudflare/vite.config";

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
          Text.local("ALCHEMY_STACK_NAME", "effront-alchemy-cloudflare"),
          Text.local("ALCHEMY_STAGE", "test"),
        ],
        name: "effront-alchemy-cloudflare-app",
      },
    }),
  ],
  root: fileURLToPath(new URL("../../examples/alchemy-cloudflare/", import.meta.url)),
});
