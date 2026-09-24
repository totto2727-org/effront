import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env["EFFRONT_DOCS_TEST_PORT"] ?? 4394);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("EFFRONT_DOCS_TEST_PORT must be a valid TCP port.");
}
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: ".",
  testMatch: "*.e2e.ts",
  outputDir: "../tmp/browser-results",
  forbidOnly: true,
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `vp build --config tests/vite.config.ts && vp preview --config tests/vite.config.ts --host 127.0.0.1 --port ${port} --strictPort`,
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    url: baseURL,
    timeout: 180_000,
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
  },
});
