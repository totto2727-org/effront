import { fileURLToPath } from "node:url";
import * as Text from "@alchemy.run/cloudflare-runtime/core/bindings/Text";
import cloudflare from "@alchemy.run/cloudflare-runtime/vite";
import { effrontWorkerOptions } from "@effront/alchemy/cloudflare";
import { defineConfig } from "vite-plus";
import { alchemyViteDefines } from "../alchemy-vite-config";

const { env, vite } = effrontWorkerOptions("loading");
import application from "../../examples/loading/vite.config";

// Test-only local host for the independent Loading application.
export default defineConfig({
  ...application,
  root: fileURLToPath(new URL("../../examples/loading/", import.meta.url)),
  define: alchemyViteDefines(env),
  plugins: [
    application.plugins,
    cloudflare({
      compatibilityDate: "2026-09-01",
      ...vite,
      worker: {
        name: "effront-loading-example",
        bindings: [
          Text.local("ALCHEMY_STACK_NAME", "effront-loading-example"),
          Text.local("ALCHEMY_STAGE", "test"),
        ],
      },
    }),
  ],
});
