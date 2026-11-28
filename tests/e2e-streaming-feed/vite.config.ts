import { fileURLToPath } from "node:url";
import * as Text from "@alchemy.run/cloudflare-runtime/core/bindings/Text";
import cloudflare from "@alchemy.run/cloudflare-runtime/vite";
import { effrontWorkerOptions } from "@effront/alchemy/cloudflare";
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";
import { alchemyViteDefines } from "../alchemy-vite-config";

const { env, vite } = effrontWorkerOptions("streaming_feed");

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
  define: alchemyViteDefines(env),
  plugins: [
    effront(
      explicitLoader
        ? {
            applications: [
              { name: "streaming_feed", entry: "./src/unused-configured-application.tsx" },
            ],
          }
        : {},
    ),
    effrontAlchemy({
      workers: explicitLoader
        ? fileURLToPath(new URL("./entry.explicit-loader.ts", import.meta.url))
        : "./src/entry.workers.ts",
    }),
    cloudflare({
      compatibilityDate: "2026-09-01",
      ...vite,
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
