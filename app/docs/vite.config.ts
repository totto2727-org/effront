import { effrontTailwind } from "@effront/tailwind";
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

// oxlint-disable-next-line import/no-default-export -- Vite loads configuration through the default export.
export default defineConfig({
  plugins: [effrontTailwind({ stylesheet: "./src/styles.css" }), effront(), effrontAlchemy()],
});
