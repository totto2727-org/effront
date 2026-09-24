import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testMatch: "*.e2e.ts",
  forbidOnly: true,
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:1451",
    trace: "retain-on-failure",
  },
  webServer: {
    // Clear the test-owned optimizer cache before Vite starts so readiness covers a real cold workerd startup.
    command:
      "node ./prepare-dev.mjs && vp dev --config vite.config.ts --host 127.0.0.1 --port 1451 --strictPort > tmp/host.log 2>&1",
    cwd: fileURLToPath(new URL(".", import.meta.url)),
    url: "http://127.0.0.1:1451/",
    reuseExistingServer: false,
    timeout: 120_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
  },
});
