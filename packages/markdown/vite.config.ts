import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    tsconfig: "./tsconfig.build.json",
    format: "esm",
    platform: "neutral",
    entry: {
      "*": ["src/**/*.ts", "src/**/*.tsx", "!src/**/*.test.ts", "!src/**/*.test.tsx"],
    },
    dts: true,
    unbundle: true,
    outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  },
  run: {
    tasks: {
      pack: {
        command: "vp pack",
        input: [{ auto: true }, "!dist/**"],
        output: ["dist/**"],
      },
    },
  },
});
