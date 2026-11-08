import { effrontTailwind } from "@effront/tailwind";
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";
import { generateIgnorePatterns } from "@totto2727/gitignore-patterns";

const ignorePatterns = await generateIgnorePatterns(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [effrontTailwind({ stylesheet: "./src/styles.css" }), effront(), effrontAlchemy()],
  // Explicit so the example keeps its lint setup when used outside this workspace.
  lint: {
    ignorePatterns,
    plugins: ["eslint", "typescript", "unicorn", "oxc", "react"],
    options: { typeAware: true, typeCheck: true },
  },
});
