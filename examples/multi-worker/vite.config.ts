import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [
    effront({
      applications: [
        { name: "storefront", entry: "./src/storefront.tsx" },
        { name: "backoffice", entry: "./src/backoffice.tsx" },
      ],
    }),
    effrontAlchemy({ workers: "./src/entry.workers.ts" }),
  ],
});
