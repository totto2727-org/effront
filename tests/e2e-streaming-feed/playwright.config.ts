import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const suite = fileURLToPath(new URL(".", import.meta.url));
const hosts = [
  {
    name: "production",
    port: 18221,
    command:
      "vp build --config vite.config.ts && vp preview --config vite.config.ts --host 127.0.0.1 --port 18221 --strictPort",
  },
  {
    name: "development",
    port: 18222,
    command: "vp dev --config vite.config.ts --host 127.0.0.1 --port 18222 --strictPort",
  },
];

export default defineConfig({
  testDir: ".",
  testMatch: "*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  use: { browserName: "chromium" },
  projects: hosts.map(({ name, port }) => ({ name, use: { baseURL: `http://127.0.0.1:${port}` } })),
  webServer: hosts.map(({ port, command }) => ({
    cwd: suite,
    command,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  })),
});
