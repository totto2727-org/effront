import { effrontCloudflare } from "@effront/cloudflare";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

// oxlint-disable-next-line import/no-default-export -- Vite loads its configuration from a default export.
export default defineConfig({
  plugins: [effront(), effrontCloudflare()],
});
