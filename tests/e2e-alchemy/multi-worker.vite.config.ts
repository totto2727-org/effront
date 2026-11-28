import { fileURLToPath } from "node:url";
import * as Text from "@alchemy.run/cloudflare-runtime/core/bindings/Text";
import cloudflare from "@alchemy.run/cloudflare-runtime/vite";
import { effrontWorkerOptions } from "@effront/alchemy/cloudflare";
import { defineConfig } from "vite-plus";
import application from "../../examples/multi-worker/vite.config";

// Reproduce the per-Worker Vite options Alchemy injects without requiring a profile.
export default defineConfig(({ mode }) => {
  const { env, vite } = effrontWorkerOptions(mode);
  return {
    ...application,
    root: fileURLToPath(new URL("../../examples/multi-worker/", import.meta.url)),
    define: Object.fromEntries(
      Object.entries(env).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
    ),
    plugins: [
      application.plugins,
      cloudflare({
        ...vite,
        compatibilityDate: "2026-09-01",
        worker: {
          name: mode,
          bindings: [
            Text.local("ALCHEMY_STACK_NAME", "effront-multi-worker"),
            Text.local("ALCHEMY_STAGE", "test"),
          ],
        },
      }),
    ],
  };
});
