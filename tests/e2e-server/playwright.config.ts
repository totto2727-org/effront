import { defineConfig } from "@playwright/test";

const fixtures = `${import.meta.dirname}/fixtures`;
// Playwright starts web servers in this order. Preview reuses the completed Node build.
const hosts = [
  {
    command: "vp build && node dist/rsc/server.js",
    cwd: `${fixtures}/node`,
    name: "node",
    port: 4451,
  },
  {
    command: "vp build && bun dist/rsc/server.js",
    cwd: `${fixtures}/bun`,
    name: "bun",
    port: 4452,
  },
  {
    command: "vp preview --host 127.0.0.1 --port 4454 --strictPort",
    cwd: `${fixtures}/node`,
    name: "preview",
    port: 4454,
  },
  {
    command: "vp dev --host 127.0.0.1 --port 4453 --strictPort",
    cwd: `${fixtures}/node`,
    name: "dev",
    port: 4453,
  },
];

// oxlint-disable-next-line import/no-default-export -- Playwright reads this configuration from the default export.
export default defineConfig({
  fullyParallel: false,
  projects: hosts.map(({ name, port }) => ({ name, use: { baseURL: `http://127.0.0.1:${port}` } })),
  testDir: ".",
  testMatch: "*.e2e.ts",
  use: { browserName: "chromium" },
  webServer: hosts.map(({ command, cwd, port }) => ({
    command,
    cwd,
    env: { HOST: "127.0.0.1", PORT: String(port) },
    reuseExistingServer: false,
    timeout: 90_000,
    url: `http://127.0.0.1:${port}`,
  })),
  workers: 1,
});
