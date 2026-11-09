import { fileURLToPath } from "node:url";
import * as Text from "@alchemy.run/cloudflare-runtime/core/bindings/Text";
import cloudflare from "@alchemy.run/cloudflare-runtime/vite";
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

const explicitLoader = process.env["EFFRONT_TEST_EXPLICIT_LOADER"] === "1";

// Test-owned local Worker host avoids requiring an authenticated Alchemy CLI profile.
export default defineConfig({
  root: fileURLToPath(new URL("../../examples/streaming-feed/", import.meta.url)),
  cacheDir: fileURLToPath(
    new URL(
      explicitLoader
        ? "./node_modules/.vite-explicit-loader"
        : "./node_modules/.vite-configured-application",
      import.meta.url,
    ),
  ),
  plugins: [
    effront(explicitLoader ? { application: "./src/unused-configured-application.tsx" } : {}),
    effrontAlchemy(
      explicitLoader
        ? { worker: fileURLToPath(new URL("./entry.explicit-loader.ts", import.meta.url)) }
        : {},
    ),
    cloudflare({
      compatibilityDate: "2026-09-01",
      compatibilityFlags: ["nodejs_compat"],
      viteEnvironments: { entry: "rsc", children: ["ssr"] },
      worker: {
        name: "effront-streaming-feed-example",
        bindings: [
          Text.local("ALCHEMY_STACK_NAME", "effront-streaming-feed-example"),
          Text.local("ALCHEMY_STAGE", "test"),
        ],
      },
    }),
  ],
});
