import { defineConfig } from "@playwright/test";

const hosts = [
  { name: "production", port: 18221, command: "vp build && vp run start" },
  {
    name: "development",
    port: 18222,
    command: "vp dev --host 127.0.0.1 --port 18222 --strictPort",
  },
];

export default defineConfig({
  testDir: "./e2e",
  testMatch: "*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  use: { browserName: "chromium" },
  projects: hosts.map(({ name, port }) => ({ name, use: { baseURL: `http://127.0.0.1:${port}` } })),
  webServer: hosts.map(({ port, command }) => ({
    command,
    env: { PORT: String(port), HOST: "127.0.0.1" },
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  })),
});
