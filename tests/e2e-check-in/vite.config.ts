import { fileURLToPath } from "node:url";
import * as Text from "@alchemy.run/cloudflare-runtime/core/bindings/Text";
import cloudflare from "@alchemy.run/cloudflare-runtime/vite";
import { defineConfig } from "vite-plus";
import application from "../../examples/check-in/vite.config";

// Auth-free local Worker host. The public example remains owned by Alchemy CLI.
export default defineConfig({
  ...application,
  root: fileURLToPath(new URL("../../examples/check-in/", import.meta.url)),
  plugins: [
    application.plugins,
    cloudflare({
      compatibilityDate: "2026-09-01",
      compatibilityFlags: ["nodejs_compat"],
      viteEnvironments: { entry: "rsc", children: ["ssr"] },
      worker: {
        name: "effront-check-in-example",
        bindings: [
          Text.local("ALCHEMY_STACK_NAME", "effront-check-in-example"),
          Text.local("ALCHEMY_STAGE", "test"),
        ],
      },
    }),
  ],
});
