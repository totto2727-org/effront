import { defineConfig } from "vite-plus";

// oxlint-disable-next-line import/no-default-export -- Vite+ loads this configuration through its default export.
export default defineConfig({
  pack: {
    copy: ["src/*.d.ts"],
    css: { inject: true },
    deps: { neverBundle: ["node:async_hooks"] },
    dts: true,
    entry: {
      "*": [
        "src/**/*.{ts,tsx}",
        "!src/**/*.d.ts",
        "!src/**/*.fixture.ts",
        "!src/**/*.test.ts",
        "!src/**/*.test.tsx",
      ],
    },
    format: "esm",
    outExtensions: () => ({ dts: ".d.ts", js: ".js" }),
    platform: "neutral",
    tsconfig: "./tsconfig.build.json",
    unbundle: true,
  },
  run: {
    tasks: {
      pack: {
        cache: {
          input: [{ auto: true }, "!dist/**"],
          output: ["dist/**"],
        },
        command: "vp pack",
      },
    },
  },
});
