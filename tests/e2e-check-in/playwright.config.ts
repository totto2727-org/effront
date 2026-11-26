import { defineConfig } from "@playwright/test";

// oxlint-disable-next-line import/no-default-export -- Playwright reads this configuration from the default export.
export default defineConfig({
  fullyParallel: false,
  testDir: ".",
  testMatch: "*.e2e.ts",
  use: { baseURL: "http://127.0.0.1:4395", browserName: "chromium" },
  webServer: [
    {
      command:
        "vp build --config vite.config.ts && vp preview --config vite.config.ts --host 127.0.0.1 --port 4395 --strictPort",
      cwd: import.meta.dirname,
      reuseExistingServer: false,
      timeout: 120_000,
      url: "http://127.0.0.1:4395",
    },
  ],
  workers: 1,
});
