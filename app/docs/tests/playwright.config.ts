import { defineConfig, devices } from "@playwright/test";

const docsDirectory = `${import.meta.dirname}/..`;

// oxlint-disable-next-line import/no-default-export -- Playwright reads this configuration from the default export.
export default defineConfig({
  forbidOnly: true,
  outputDir: "../tmp/browser-results",
  reporter: "list",
  testDir: ".",
  testMatch: "*.e2e.ts",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4394",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "vp build --config tests/vite.config.ts && vp preview --config tests/vite.config.ts --host 127.0.0.1 --port 4394 --strictPort",
    cwd: docsDirectory,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
    reuseExistingServer: false,
    timeout: 180_000,
    url: "http://127.0.0.1:4394",
  },
  workers: 1,
});
