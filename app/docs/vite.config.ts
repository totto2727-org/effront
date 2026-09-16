import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@alchemy.run/cloudflare-runtime/vite";
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { defineConfig } from "vite-plus";
import { stack } from "./stack";

export default defineConfig({
  plugins: [
    tailwindcss(),
    effrontAlchemy({ worker: "./src/entry.workers.ts", stack }),
    process.env["ALCHEMY_CLOUDFLARE_VITE_INJECTED"] === "1"
      ? []
      : cloudflare({
          compatibilityDate: "2026-09-01",
          compatibilityFlags: ["nodejs_compat"],
          viteEnvironments: { entry: "rsc", children: ["ssr"] },
        }),
  ],
  // Explicit so the example keeps its lint setup when used outside this workspace.
  lint: {
    plugins: ["eslint", "typescript", "unicorn", "oxc", "react"],
    options: { typeAware: true, typeCheck: true },
  },
});
