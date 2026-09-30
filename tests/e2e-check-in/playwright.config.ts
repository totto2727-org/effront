import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

export default defineConfig({
  testDir: ".",
  testMatch: "*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  use: { browserName: "chromium", baseURL: "http://127.0.0.1:4395" },
  webServer: [
    {
      cwd: fileURLToPath(new URL(".", import.meta.url)),
      command:
        "vp build --config vite.config.ts && vp preview --config vite.config.ts --host 127.0.0.1 --port 4395 --strictPort",
      url: "http://127.0.0.1:4395",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
