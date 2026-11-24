import { execFile } from "node:child_process";
import { architectureBaseline } from "./architecture-baseline.ts";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";
import { corePages, coreSources } from "./core.ts";

const exec = promisify(execFile);
const repository = new URL("../../../../", import.meta.url);
const gitTimeout = 4000;

const baselineSource = async (path: string): Promise<string> => {
  const { stdout } = await exec("git", ["show", `${architectureBaseline.commit}:${path}`], {
    cwd: repository,
    timeout: gitTimeout,
  });
  return stdout;
};

// Source is inspected only by tests. Production pages ship authored snippets, not filesystem reads.
describe("current core learning material", () => {
  test("records the version from the exact architecture baseline commit", async () => {
    const manifest = await baselineSource("packages/core/package.json");
    expect(JSON.parse(manifest)).toMatchObject({
      name: "@effront/core",
      version: architectureBaseline.version,
    });
    expect(architectureBaseline.commit).toMatch(/^[a-f0-9]{40}$/u);
  });

  test.each(coreSources)(
    "keeps the $path excerpt identical to current implementation",
    async (source) => {
      expect(source.path).toMatch(/^packages\/core\/src\/[a-z0-9/.-]+\.tsx?$/u);
      expect(source.code.length).toBeGreaterThan(60);
      const implementation = await readFile(new URL(source.path, repository), "utf8");
      expect(implementation).toContain(source.code);
    },
  );

  test.each(coreSources)(
    "retains the $path excerpt in the architecture baseline",
    async (source) => {
      const baseline = await baselineSource(source.path);
      expect(baseline).toContain(source.code);
    },
  );

  test.each(corePages)("explains $slug with current source and navigable sections", (page) => {
    const html = renderToStaticMarkup(page.content());
    expect(html).toContain("data-core-source=");
    expect(html).not.toMatch(/data-reading-excerpt|data-baseline|data-comparison/u);
    expect(page.section).toBe("アーキテクチャ");
    expect(page.headings.length).toBeGreaterThanOrEqual(3);
  });
});
