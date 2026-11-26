import { generateIgnorePatterns } from "@totto2727/gitignore-patterns";
import preset from "@totto2727/oxlint/preset";
import applicationPreset from "@totto2727/oxlint/preset/application";
import libraryPreset from "@totto2727/oxlint/preset/library";
import { defineConfig } from "vite-plus";

// Regenerate effective exclusions from reachable .gitignore files on every config load.
const ignorePatterns = await generateIgnorePatterns(new URL(".", import.meta.url));

// oxlint-disable-next-line import/no-default-export -- VitePlus reads the root configuration through its default export.
export default defineConfig({
  fmt: { ignorePatterns },
  lint: {
    extends: [preset],
    // Raw templates resolve their imports in generated applications.
    ignorePatterns: [...ignorePatterns, "packages/create-effront/templates/**"],
    options: { typeCheck: true },
    overrides: [
      {
        files: ["{app,examples,tests}/**"],
        rules: { "rules/effect-tracing": applicationPreset.rules["rules/effect-tracing"] },
      },
      {
        files: ["packages/**"],
        rules: { "rules/effect-tracing": libraryPreset.rules["rules/effect-tracing"] },
      },
      {
        // The packaged declaration must stay ambient. Oxlint reports its zero-width diagnostic before inline directives.
        files: ["packages/core/src/application-entry.d.ts"],
        rules: { "import/unambiguous": "off" },
      },
    ],
  },
  resolve: { tsconfigPaths: true },
  run: {
    tasks: {
      check: { cache: false, command: "vp check" },
      fix: { cache: false, command: "vp check --fix" },
      test: { cache: false, command: "vp test run" },
    },
  },
  test: { include: ["{app,examples,packages,tests}/**/*.test.{ts,tsx}"] },
});
