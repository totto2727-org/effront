import application from "@totto2727/oxlint/preset/application";
import type { ViteUserConfig } from "vite-plus";

export function createLintConfig(ignorePatterns: string[]): NonNullable<ViteUserConfig["lint"]> {
  return {
    ignorePatterns,
    jsPlugins: application.jsPlugins ?? [],
    rules: {
      "rules/consistent-import-extension": "error",
      "rules/effect-tracing": ["error", "application"],
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
  };
}
