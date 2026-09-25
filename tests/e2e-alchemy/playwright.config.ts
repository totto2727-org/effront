import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testMatch: "*.e2e.ts",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4393" },
  webServer: [
    {
      // Exercise Basic without copying or generating its application source.
      command:
        "vp build --config vite.config.ts && vp preview --config vite.config.ts --host 127.0.0.1 --port 4393 --strictPort",
      cwd: fileURLToPath(new URL(".", import.meta.url)),
      url: "http://127.0.0.1:4393",
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      // Loading owns its own application root and local Worker host.
      command:
        "vp build --config loading.vite.config.ts && vp preview --config loading.vite.config.ts --host 127.0.0.1 --port 4394 --strictPort",
      cwd: fileURLToPath(new URL(".", import.meta.url)),
      url: "http://127.0.0.1:4394",
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
