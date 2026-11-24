import application from "@totto2727/oxlint/preset/application";
import type { ViteUserConfig } from "vite-plus";

export const createLintConfig = (
  ignorePatterns: string[],
): NonNullable<ViteUserConfig["lint"]> => ({
  ...application,
  ignorePatterns,
  options: { ...application.options, typeCheck: true },
  overrides: [
    ...(application.overrides ?? []),
    { env: { node: true }, files: ["vite.config.ts", "src/entry.server.ts"] },
  ],
});
