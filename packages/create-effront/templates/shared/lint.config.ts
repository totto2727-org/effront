import application from "@totto2727/oxlint/preset/application";
import type { ViteUserConfig } from "vite-plus";

export const createLintConfig = (
  ignorePatterns: string[],
): NonNullable<ViteUserConfig["lint"]> => ({
  extends: [application],
  ignorePatterns,
  options: { typeCheck: true },
});
