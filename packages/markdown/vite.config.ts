import { cpSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

const packageRoot = resolve(fileURLToPath(new URL(".", import.meta.url)));
const require = createRequire(import.meta.url);
const katexRoot = dirname(require.resolve("katex/package.json"));
const katexFonts = resolve(katexRoot, "dist/fonts");
const katexLicense = resolve(katexRoot, "LICENSE");

const katexFontAssets = {
  name: "effront-markdown-katex-fonts",
  closeBundle() {
    const dist = resolve(packageRoot, "dist");
    cpSync(katexFonts, resolve(dist, "fonts"), { recursive: true });
    cpSync(katexLicense, resolve(dist, "KaTeX-LICENSE"));
  },
};

export default defineConfig({
  pack: {
    plugins: [katexFontAssets],
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
