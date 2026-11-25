// oxlint-disable-next-line rules/no-node-imports -- The host configuration resolves physical files for Vite on Node.
import { fileURLToPath } from "node:url";
import * as Text from "@alchemy.run/cloudflare-runtime/core/bindings/Text";
import cloudflare from "@alchemy.run/cloudflare-runtime/vite";
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

// oxlint-disable-next-line node/no-process-env -- The fixture's shell script selects which loader entry the local host builds.
const explicitLoader = process.env["EFFRONT_TEST_EXPLICIT_LOADER"] === "1";
const cacheDirectory = explicitLoader
  ? "./node_modules/.vite-explicit-loader"
  : "./node_modules/.vite-configured-application";
const explicitEntry = fileURLToPath(new URL("entry.explicit-loader.ts", import.meta.url));
const applicationOptions = explicitLoader
  ? { application: "./src/unused-configured-application.tsx" }
  : {};
const workerOptions = explicitLoader ? { worker: explicitEntry } : {};

// The local test host needs no authenticated Alchemy CLI profile.
// oxlint-disable-next-line import/no-default-export -- Vite loads its configuration through the default export.
export default defineConfig({
  cacheDir: fileURLToPath(new URL(cacheDirectory, import.meta.url)),
  plugins: [
    effront(applicationOptions),
    effrontAlchemy(workerOptions),
    cloudflare({
      compatibilityDate: "2026-09-01",
      compatibilityFlags: ["nodejs_compat"],
      viteEnvironments: { children: ["ssr"], entry: "rsc" },
      worker: {
        bindings: [
          Text.local("ALCHEMY_STACK_NAME", "effront-streaming-feed-example"),
          Text.local("ALCHEMY_STAGE", "test"),
        ],
        name: "effront-streaming-feed-example",
      },
    }),
  ],
  root: fileURLToPath(new URL("../../examples/streaming-feed/", import.meta.url)),
});
