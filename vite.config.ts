import { generateIgnorePatterns } from "@totto2727/gitignore-patterns";
import preset from "@totto2727/oxlint/preset";
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
    // Stage shared rules that are ready for CI without suppressing full-preset violations.
    jsPlugins: preset.jsPlugins ?? [],
    plugins: ["eslint", "typescript", "unicorn", "oxc", "react"],
    rules: {
      "rules/consistent-import-extension": "error",
      "rules/force-array-empty": "error",
      "rules/force-iterable-empty": "error",
      "rules/force-string-empty": "error",
      "rules/no-bigint-literals": "error",
      "rules/no-eslint-disable-comments": "error",
      "rules/no-index-filename": "error",
      "rules/no-jsx-script-tag": "error",
      "rules/no-opaque-instance-fields": "error",
      "rules/no-redundant-alias": "error",
      "rules/no-string-style": "error",
      "rules/no-sync-decode": "error",
      "rules/prefer-is-nullish": "error",
      "rules/require-disable-reason": "error",
      "rules/require-top-level-decoder": "error",
    },
    overrides: [
      {
        files: ["packages/**/*.{ts,tsx}"],
        rules: { "rules/effect-tracing": ["error", "library"] },
      },
      {
        // Tests and fixtures exercise the public, application-facing API.
        files: [
          "{app,examples,tests}/**/*.{ts,tsx}",
          "packages/**/*.{test,types}.{ts,tsx}",
          "packages/*/tests/**/*.{ts,tsx}",
          "packages/create-effront/src/{cli,main}.ts",
        ],
        rules: { "rules/effect-tracing": ["error", "application"] },
      },
      {
        // The Tailwind integration does not depend on Effect.
        files: ["packages/tailwind/**"],
        rules: {
          "rules/force-array-empty": "off",
          "rules/force-iterable-empty": "off",
          "rules/force-string-empty": "off",
        },
      },
    ],
    // Raw template sources are not a workspace project; their imports resolve in generated projects.
    ignorePatterns: [...ignorePatterns, "packages/create-effront/templates/**"],
    options: { typeAware: true, typeCheck: true },
  },
});
