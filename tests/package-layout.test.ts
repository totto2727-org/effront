import { execFileSync } from "node:child_process";
import { globSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vite-plus/test";
import core from "../packages/core/package.json" with { type: "json" };

const repository = fileURLToPath(new URL("../", import.meta.url));
const packages = globSync("packages/*/package.json", { cwd: repository });

it("uses responsibility-named TypeScript modules instead of implicit index entries", () => {
  const entries = globSync("{packages,app,examples,tests}/**/index.{ts,tsx}", {
    cwd: repository,
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/tmp/**",
      "**/.runtime/**",
      "**/.alchemy/**",
      "**/test-results/**",
      "**/playwright-report/**",
    ],
  });
  expect(entries).toEqual([]);
});

function targets(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value !== "object" || value === null) return [];
  return Object.values(value).flatMap(targets);
}

it.each(packages)(
  "packs every public export of %s at the synchronized release",
  (manifest) => {
    mkdirSync(join(repository, "tmp"), { recursive: true });
    const temporary = mkdtempSync(join(repository, "tmp/package-layout-"));
    try {
      const archive = join(temporary, "package.tgz");
      execFileSync("vp", ["pm", "pack", "--out", archive], {
        cwd: join(repository, manifest, ".."),
        encoding: "utf8",
      });
      const files = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" }).split("\n");
      const published: unknown = JSON.parse(
        execFileSync("tar", ["-xOf", archive, "package/package.json"], { encoding: "utf8" }),
      );
      expect(published).toHaveProperty("version", core.version);
      if (typeof published !== "object" || published === null || !("exports" in published)) {
        throw new TypeError("A public package must declare its exports.");
      }
      const exports = targets(published.exports);
      expect(exports.length).toBeGreaterThan(0);
      for (const target of exports) {
        expect(files, target).toContain(`package/${target.replace(/^\.\//, "")}`);
        expect(basename(target)).not.toMatch(/^index\.(?:js|d\.ts)$/);
      }
      expect(files.filter((file) => /\.(?:test|e2e)\.[cm]?[jt]sx?$/.test(file))).toEqual([]);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  },
  30_000,
);
