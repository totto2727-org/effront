import { defineConfig } from "@playwright/test";

// oxlint-disable-next-line import/no-default-export -- Playwright reads this configuration from the default export.
export default defineConfig({
  testMatch: "*.e2e.ts",
  use: { baseURL: "http://127.0.0.1:4393" },
  webServer: [
    {
      command:
        "vp build --config starter.vite.config.ts && vp preview --config starter.vite.config.ts --host 127.0.0.1 --port 4395 --strictPort",
      cwd: import.meta.dirname,
      reuseExistingServer: false,
      timeout: 120_000,
      url: "http://127.0.0.1:4395",
    },
    {
      // Exercise Basic without copying or generating its application source.
      command:
        "vp build --config vite.config.ts && vp preview --config vite.config.ts --host 127.0.0.1 --port 4393 --strictPort",
      cwd: import.meta.dirname,
      reuseExistingServer: false,
      timeout: 120_000,
      url: "http://127.0.0.1:4393",
    },
    {
      // Loading owns its own application root and local Worker host.
      command:
        "vp build --config loading.vite.config.ts && vp preview --config loading.vite.config.ts --host 127.0.0.1 --port 4394 --strictPort",
      cwd: import.meta.dirname,
      reuseExistingServer: false,
      timeout: 120_000,
      url: "http://127.0.0.1:4394",
    },
  ],
  workers: 1,
});
