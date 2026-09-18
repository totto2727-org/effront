import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "*.e2e.ts",
  outputDir: "../tmp/browser-results",
  forbidOnly: true,
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4394",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "vp build --config tests/vite.config.ts && vp preview --config tests/vite.config.ts --host 127.0.0.1 --port 4394 --strictPort",
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    url: "http://127.0.0.1:4394",
    timeout: 180_000,
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
  },
});
