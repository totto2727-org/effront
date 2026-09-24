import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effrontTailwind } from "@effront/tailwind";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [await effrontTailwind({ root: import.meta.dirname }), effront(), effrontAlchemy()],
  // Explicit so the example keeps its lint setup when used outside this workspace.
  lint: {
    plugins: ["eslint", "typescript", "unicorn", "oxc", "react"],
    options: { typeAware: true, typeCheck: true },
  },
});
