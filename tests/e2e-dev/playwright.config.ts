import { defineConfig, devices } from "@playwright/test";

// oxlint-disable-next-line import/no-default-export -- Playwright reads this configuration from the default export.
export default defineConfig({
  forbidOnly: true,
  reporter: "list",
  testDir: "./tests",
  testMatch: "**/*.e2e.ts",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4174",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "vp dev --host 127.0.0.1 --port 4174 --strictPort",
    gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
    reuseExistingServer: false,
    timeout: 120_000,
    url: "http://127.0.0.1:4174/manual",
  },
  workers: 1,
});
