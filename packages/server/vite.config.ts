import { defineConfig } from "vite-plus";

// oxlint-disable-next-line import/no-default-export -- Vite+ loads its configuration through the default export.
export default defineConfig({
  pack: {
    dts: true,
    entry: {
      "*": ["src/**/*.ts", "!src/**/*.test.ts", "!src/**/*.fixture.ts"],
    },
    format: "esm",
    outExtensions: () => ({ dts: ".d.ts", js: ".js" }),
    platform: "node",
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
