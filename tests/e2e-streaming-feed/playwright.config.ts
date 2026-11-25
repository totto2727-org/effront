import { defineConfig } from "@playwright/test";

const suite = import.meta.dirname;
const hosts = [
  {
    command:
      "vp build --config vite.config.ts && vp preview --config vite.config.ts --host 127.0.0.1 --port 18221 --strictPort",
    name: "production",
    port: 18_221,
  },
  {
    command: "vp dev --config vite.config.ts --host 127.0.0.1 --port 18222 --strictPort",
    name: "development",
    port: 18_222,
  },
];

// oxlint-disable-next-line import/no-default-export -- Playwright reads this configuration from the default export.
export default defineConfig({
  fullyParallel: false,
  projects: hosts.map(({ name, port }) => ({ name, use: { baseURL: `http://127.0.0.1:${port}` } })),
  testDir: ".",
  testMatch: "*.e2e.ts",
  use: { browserName: "chromium" },
  webServer: hosts.map(({ port, command }) => ({
    command,
    cwd: suite,
    reuseExistingServer: false,
    timeout: 120_000,
    url: `http://127.0.0.1:${port}`,
  })),
  workers: 1,
});
