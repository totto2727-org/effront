import { effrontTailwind } from "@effront/tailwind";
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effront } from "@effront/vite";
import { randomUUID } from "node:crypto";
import { defineConfig } from "vite-plus";

// Vite evaluates this config once for all docs environment graphs. Tests may pin
// the ID so the worker and client graph deliberately share an observable value.
const configuredBuildId = process.env["EFFRONT_BUILD_ID"];
if (
  configuredBuildId !== undefined &&
  (!/^[A-Za-z0-9._-]+$/.test(configuredBuildId) ||
    configuredBuildId === "." ||
    configuredBuildId === "..")
) {
  throw new Error("EFFRONT_BUILD_ID must be a non-empty header-safe token.");
}
const buildId = configuredBuildId ?? randomUUID();

export default defineConfig({
  define: {
    "import.meta.env.VITE_EFFRONT_BUILD_ID": JSON.stringify(buildId),
  },
  plugins: [effrontTailwind({ stylesheet: "./src/styles.css" }), effront(), effrontAlchemy()],
  // Explicit so the example keeps its lint setup when used outside this workspace.
  lint: {
    plugins: ["eslint", "typescript", "unicorn", "oxc", "react"],
    options: { typeAware: true, typeCheck: true },
  },
});
