import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import cloudflare from "@alchemy.run/cloudflare-runtime/vite";
import * as Text from "@alchemy.run/cloudflare-runtime/core/bindings/Text";
import { defineConfig } from "vite-plus";
import application from "../vite.config";

// Same local-host pattern as tests/e2e-alchemy. The actual site entry and plugins
// are built unchanged, without evaluating alchemy.run.ts or touching cloud state.
export default defineConfig({
  ...application,
  root: fileURLToPath(new URL("../", import.meta.url)),
  plugins: [
    application.plugins,
    cloudflare({
      compatibilityDate: "2026-09-01",
      compatibilityFlags: ["nodejs_compat"],
      viteEnvironments: { entry: "rsc", children: ["ssr"] },
      worker: {
        name: "effront-docs-acceptance",
        // Alchemy's deploy/local providers fold _headers into the asset config.
        // This direct, authentication-free runtime host must do the same explicitly.
        assets: {
          headers: readFileSync(new URL("../public/_headers", import.meta.url), "utf8"),
        },
        bindings: [
          Text.local("ALCHEMY_STACK_NAME", "effront-docs-acceptance"),
          Text.local("ALCHEMY_STAGE", "test"),
        ],
      },
    }),
  ],
});
