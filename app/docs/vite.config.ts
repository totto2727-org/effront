import { effrontTailwind } from "@effront/tailwind";
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [
    effrontTailwind({ stylesheet: "./src/styles.css" }),
    effront(),
    effrontAlchemy(),
    {
      name: "tot-238-disable-server-dependency-discovery",
      enforce: "post",
      apply: "serve",
      configEnvironment(name) {
        if (name === "rsc" || name === "ssr") {
          return { optimizeDeps: { noDiscovery: true, include: [] } };
        }
        return undefined;
      },
    },
  ],
  // Explicit so the example keeps its lint setup when used outside this workspace.
  lint: {
    plugins: ["eslint", "typescript", "unicorn", "oxc", "react"],
    options: { typeAware: true, typeCheck: true },
  },
});
