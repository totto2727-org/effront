import { fileURLToPath } from "node:url";
import * as Text from "@alchemy.run/cloudflare-runtime/core/bindings/Text";
import cloudflare from "@alchemy.run/cloudflare-runtime/vite";
import { effrontWorkerOptions } from "@effront/alchemy/cloudflare";
import { defineConfig } from "vite-plus";
import { alchemyViteDefines } from "../alchemy-vite-config";

const { env, vite } = effrontWorkerOptions("check_in");
import application from "../../examples/check-in/vite.config";

// Auth-free local Worker host. The public example remains owned by Alchemy CLI.
export default defineConfig({
  ...application,
  root: fileURLToPath(new URL("../../examples/check-in/", import.meta.url)),
  define: alchemyViteDefines(env),
  plugins: [
    application.plugins,
    cloudflare({
      compatibilityDate: "2026-09-01",
      ...vite,
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
