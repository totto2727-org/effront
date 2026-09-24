import { cpSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

const packageRoot = resolve(fileURLToPath(new URL(".", import.meta.url)));
const katexFonts = resolve(packageRoot, "node_modules/katex/dist/fonts");

const katexFontAssets = {
  name: "effront-markdown-katex-fonts",
  closeBundle() {
    cpSync(katexFonts, resolve(packageRoot, "dist/fonts"), { recursive: true });
  },
  generateBundle() {
    for (const font of readdirSync(katexFonts)) {
      this.emitFile({ fileName: `fonts/${font}`, source: readFileSync(resolve(katexFonts, font)), type: "asset" });
    }
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
