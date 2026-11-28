import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [
    effront({
      application: { storefront: "./src/storefront.tsx", backoffice: "./src/backoffice.tsx" },
    }),
    effrontAlchemy({ workers: "./src/entry.workers.ts" }),
  ],
});
