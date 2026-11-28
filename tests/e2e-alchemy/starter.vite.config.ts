import { fileURLToPath } from "node:url";
import * as Text from "@alchemy.run/cloudflare-runtime/core/bindings/Text";
import cloudflare from "@alchemy.run/cloudflare-runtime/vite";
import { effrontWorkerOptions } from "@effront/alchemy/cloudflare";
import { defineConfig } from "vite-plus";
import { alchemyViteDefines } from "../alchemy-vite-config";

const { env, vite } = effrontWorkerOptions("app");
import application from "../../examples/alchemy-cloudflare/vite.config";

export default defineConfig({
  ...application,
  root: fileURLToPath(new URL("../../examples/alchemy-cloudflare/", import.meta.url)),
  define: alchemyViteDefines(env),
  plugins: [
    application.plugins,
    cloudflare({
      compatibilityDate: "2026-09-01",
      ...vite,
      worker: {
        name: "effront-alchemy-cloudflare-app",
        bindings: [
          Text.local("ALCHEMY_STACK_NAME", "effront-alchemy-cloudflare"),
          Text.local("ALCHEMY_STAGE", "test"),
        ],
      },
    }),
  ],
});
