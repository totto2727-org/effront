import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    tsconfig: "./tsconfig.build.json",
    format: "esm",
    platform: "node",
    entry: {
      "*": ["src/**/*.ts", "!src/**/*.test.ts"],
    },
    dts: true,
    unbundle: true,
    outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  },
  run: {
    tasks: {
      pack: {
        command: "vp pack && vp pm pack --out ../../tmp/npm/vite.tgz",
        input: [{ auto: true }, "!dist/**"],
        output: ["dist/**", { pattern: "tmp/npm/vite.tgz", base: "workspace" }],
      },
    },
  },
});
