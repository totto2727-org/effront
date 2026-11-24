// oxlint-disable-next-line rules/no-node-imports -- The build hook copies installed font assets and their license into the npm package.
import { cp } from "node:fs/promises";
import { defineConfig } from "vite-plus";

const katexPackage = new URL(import.meta.resolve("katex/package.json"));
const katexFonts = new URL("dist/fonts", katexPackage);
const katexLicense = new URL("LICENSE", katexPackage);
const dist = new URL("dist/", import.meta.url);

const katexFontAssets = {
  closeBundle: async (): Promise<void> => {
    await Promise.all([
      cp(katexFonts, new URL("fonts", dist), { recursive: true }),
      cp(katexLicense, new URL("KaTeX-LICENSE", dist)),
    ]);
  },
  name: "effront-markdown-katex-fonts",
};

// oxlint-disable-next-line import/no-default-export -- Vite+ loads its configuration through the default export.
export default defineConfig({
  pack: {
    dts: true,
    entry: {
      "*": ["src/**/*.ts", "src/**/*.tsx", "!src/**/*.test.ts", "!src/**/*.test.tsx"],
    },
    format: "esm",
    outExtensions: () => ({ dts: ".d.ts", js: ".js" }),
    platform: "neutral",
    plugins: [katexFontAssets],
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
