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
    ...preset,
    // Raw templates resolve their imports in generated applications.
    ignorePatterns: [...ignorePatterns, "packages/create-effront/templates/**"],
    options: { ...preset.options, typeCheck: true },
    overrides: [
      { env: { worker: true }, files: ["{app,examples,packages,tests}/**/*.{ts,tsx}"] },
      {
        env: { browser: true },
        files: [
          "packages/core/src/client/**/*.{ts,tsx}",
          "packages/core/tests/client/**/*.{ts,tsx}",
          "{app,examples,tests}/**/*.{tsx,jsx}",
          "app/docs/src/components/ui/**/*.{ts,tsx}",
          "{app,tests}/**/*.{e2e,spec,test}.{ts,tsx}",
          "{app,tests}/**/*.browser.fixture.{ts,tsx}",
        ],
      },
      {
        env: { node: true },
        files: [
          "vite.config.ts",
          "**/*.config.ts",
          "**/alchemy.run.ts",
          "**/*.test.{ts,tsx}",
          "{packages/create-effront,packages/server,packages/vite,tests}/**/*.{ts,tsx}",
          "examples/{node,bun}/src/entry.server.ts",
        ],
      },
      {
        files: ["packages/**/*.{ts,tsx}"],
        rules: { ...libraryPreset.rules },
      },
      {
        // Tests and fixtures exercise the public application API.
        files: [
          "{app,examples,tests}/**/*.{ts,tsx}",
          "packages/**/*.{test,types}.{ts,tsx}",
          "packages/*/tests/**/*.{ts,tsx}",
          "packages/create-effront/src/{cli,main}.ts",
        ],
        rules: { ...applicationPreset.rules },
      },
      ...(preset.overrides ?? []),
      {
        // The Vite virtual module uses an ambient script. This diagnostic has a zero-width span at the start of the file.
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
