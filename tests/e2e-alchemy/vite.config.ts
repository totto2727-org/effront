import { fileURLToPath } from "node:url";
import * as KvNamespace from "@alchemy.run/cloudflare-runtime/core/bindings/kv-namespace/KvNamespace";
import cloudflare from "@alchemy.run/cloudflare-runtime/vite";
import { effrontWorkerOptions } from "@effront/alchemy/cloudflare";
import { defineConfig } from "vite-plus";
import { alchemyViteDefines } from "../alchemy-vite-config";

const { env, vite } = effrontWorkerOptions("app");
import application from "../../examples/basic/vite.config";
import * as Text from "@alchemy.run/cloudflare-runtime/core/bindings/Text";

// Test-only local host. Applications rely on Alchemy CLI to construct and inject their host.
export default defineConfig({
  ...application,
  root: fileURLToPath(new URL("../../examples/basic/", import.meta.url)),
  define: alchemyViteDefines(env),
  plugins: [
    application.plugins,
    cloudflare({
      compatibilityDate: "2026-09-01",
      ...vite,
      worker: {
        name: "effront-alchemy-example",
        bindings: [
          Text.local("ALCHEMY_STACK_NAME", "effront-alchemy-example"),
          Text.local("ALCHEMY_STAGE", "test"),
          KvNamespace.local({ binding: "Cache", id: "effront-example-cache" }),
        ],
      },
    }),
  ],
});
