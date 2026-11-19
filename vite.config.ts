import { generateIgnorePatterns } from "@totto2727/gitignore-patterns";
import { defineConfig } from "vite-plus";

// Regenerate effective exclusions from reachable .gitignore files on every config load.
const ignorePatterns = await generateIgnorePatterns(new URL(".", import.meta.url));

export default defineConfig({
  run: {
    tasks: {
      check: { command: "vp check", cache: false },
      fix: { command: "vp check --fix", cache: false },
      test: { command: "vp test run", cache: false },
    },
  },
  fmt: { ignorePatterns },
  test: { include: ["{app,examples,packages,tests}/**/*.test.{ts,tsx}"] },
  lint: {
    plugins: ["eslint", "typescript", "unicorn", "oxc", "react"],
    // Raw template sources are not a workspace project; their imports resolve in generated projects.
    ignorePatterns: [...ignorePatterns, "packages/create-effront/templates/**"],
    options: { typeAware: true, typeCheck: true },
  },
});
