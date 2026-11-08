import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effrontTailwind } from "@effront/tailwind";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";
import { generateIgnorePatterns } from "@totto2727/gitignore-patterns";

const ignorePatterns = await generateIgnorePatterns(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [effrontTailwind(), effront(), effrontAlchemy()],
  lint: {
    ignorePatterns,
    plugins: ["eslint", "typescript", "unicorn", "oxc", "react"],
    options: { typeAware: true, typeCheck: true },
  },
});
