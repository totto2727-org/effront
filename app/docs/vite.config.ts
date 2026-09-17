import tailwindcss from "@tailwindcss/vite";
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { defineConfig } from "vite-plus";
import { stack } from "./stack";

export default defineConfig({
  plugins: [tailwindcss(), effrontAlchemy({ worker: "./src/entry.workers.ts", stack })],
  // Explicit so the example keeps its lint setup when used outside this workspace.
  lint: {
    plugins: ["eslint", "typescript", "unicorn", "oxc", "react"],
    options: { typeAware: true, typeCheck: true },
  },
});
