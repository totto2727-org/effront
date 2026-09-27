import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const example = fileURLToPath(new URL("../../examples/check-in/", import.meta.url));
const hosts = [
  { name: "production", port: 3002, command: "node dist/rsc/server.js" },
  { name: "development", port: 1342, command: "vp dev --host 127.0.0.1 --port 1342 --strictPort" },
];

export default defineConfig({
  testDir: ".",
  testMatch: "*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  use: { browserName: "chromium" },
  projects: hosts.map(({ name, port }) => ({ name, use: { baseURL: `http://127.0.0.1:${port}` } })),
  webServer: hosts.map(({ port, command }) => ({
    cwd: example,
    command,
    env: { PORT: String(port), HOST: "127.0.0.1" },
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  })),
});
