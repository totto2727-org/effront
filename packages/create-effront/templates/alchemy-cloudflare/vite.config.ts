import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";
import { generateIgnorePatterns } from "@totto2727/gitignore-patterns";
import { createLintConfig } from "./lint.config.ts";

const ignorePatterns = await generateIgnorePatterns(new URL(".", import.meta.url));

// oxlint-disable-next-line import/no-default-export -- Vite loads its configuration from a default export.
export default defineConfig({
  fmt: { ignorePatterns },
  lint: createLintConfig(ignorePatterns),
  plugins: [effront(), effrontAlchemy()],
});
