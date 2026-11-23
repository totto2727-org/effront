import { effrontServer } from "@effront/server/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";
import { generateIgnorePatterns } from "@totto2727/gitignore-patterns";
import { createLintConfig } from "./lint.config";

const ignorePatterns = await generateIgnorePatterns(new URL(".", import.meta.url));

export default defineConfig({
  fmt: { ignorePatterns },
  lint: createLintConfig(ignorePatterns),
  plugins: [effront(), effrontServer()],
});
