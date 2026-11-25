import { defineConfig, devices } from "@playwright/test";

// oxlint-disable-next-line import/no-default-export -- Playwright reads this configuration from the default export.
export default defineConfig({
  forbidOnly: true,
  reporter: "list",
  testDir: "./tests",
  testMatch: "**/*.e2e.ts",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      'vp build && wrangler dev --local --no-bundle --config fixture/dist/rsc/wrangler.json --env-file empty.env --ip 127.0.0.1 --port 4173 --inspector-port 0 --var "APP_LABEL:Workers override" --var "GREETING:Hello from workerd binding" --var "SERVER_TOKEN:acceptance-test-secret"',
    gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
    reuseExistingServer: false,
    timeout: 120_000,
    url: "http://127.0.0.1:4173",
  },
  workers: 1,
});
