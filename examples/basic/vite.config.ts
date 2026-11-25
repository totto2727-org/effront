import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effrontTailwind } from "@effront/tailwind";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";
import { generateIgnorePatterns } from "@totto2727/gitignore-patterns";

const ignorePatterns = await generateIgnorePatterns(new URL(".", import.meta.url));

// oxlint-disable-next-line import/no-default-export -- Vite loads configuration through the default export.
export default defineConfig({
  // Explicit so the example keeps its lint setup when used outside this workspace.
  lint: {
    ignorePatterns,
    options: { typeAware: true, typeCheck: true },
    plugins: ["eslint", "typescript", "unicorn", "oxc", "react"],
  },
  plugins: [effrontTailwind(), effront(), effrontAlchemy()],
});
