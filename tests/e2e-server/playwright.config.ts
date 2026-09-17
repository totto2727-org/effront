import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const examples = fileURLToPath(new URL("../../examples/", import.meta.url));
// Playwright starts web servers in this order. Preview reuses the completed Node build.
const hosts = [
  {
    name: "node",
    port: 4451,
    cwd: `${examples}node`,
    command: "vp build && node dist/rsc/server.js",
  },
  { name: "bun", port: 4452, cwd: `${examples}bun`, command: "vp build && bun dist/rsc/server.js" },
  {
    name: "preview",
    port: 4454,
    cwd: `${examples}node`,
    command: "vp preview --host 127.0.0.1 --port 4454 --strictPort",
  },
  {
    name: "dev",
    port: 4453,
    cwd: `${examples}node`,
    command: "vp dev --host 127.0.0.1 --port 4453 --strictPort",
  },
];

export default defineConfig({
  testDir: ".",
  testMatch: "*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  use: { browserName: "chromium" },
  projects: hosts.map(({ name, port }) => ({ name, use: { baseURL: `http://127.0.0.1:${port}` } })),
  webServer: hosts.map(({ port, cwd, command }) => ({
    cwd,
    command,
    env: { PORT: String(port), HOST: "127.0.0.1" },
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 90_000,
  })),
});
