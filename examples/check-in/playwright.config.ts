import { defineConfig } from "@playwright/test";

const production = process.env["CHECK_IN_HOST"] === "production";
const port = production ? 3002 : 1342;

export default defineConfig({
  testDir: "./src",
  testMatch: "**/*.e2e.ts",
  use: { baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    command: production ? "PORT=3002 node dist/rsc/server.js" : "vp dev",
    port,
    reuseExistingServer: false,
  },
});
