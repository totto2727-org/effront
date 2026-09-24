import { execFileSync } from "node:child_process";
import { architectureBaseline } from "./architecture-baseline";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { corePages, coreSources } from "./core";
import { coreRuntimeSources } from "./core-runtime";

// Source is inspected only by tests. Production pages ship authored snippets, not filesystem reads.
describe("current core learning material", () => {
  it("records the version from the exact architecture baseline commit", () => {
    const manifest = execFileSync(
      "git",
      ["show", `${architectureBaseline.commit}:packages/core/package.json`],
      {
        cwd: new URL("../../../../", import.meta.url),
        encoding: "utf8",
      },
    );
    expect(JSON.parse(manifest)).toMatchObject({
      name: "@effront/core",
      version: architectureBaseline.version,
    });
    expect(architectureBaseline.commit).toMatch(/^[a-f0-9]{40}$/);
  });
  it.each(coreSources)("keeps the $path excerpt identical to current implementation", (source) => {
    expect(source.path).toMatch(/^packages\/core\/src\/[a-z0-9/.-]+\.tsx?$/);
    expect(source.code.length).toBeGreaterThan(60);
    const implementation = readFileSync(
      new URL(`../../../../${source.path}`, import.meta.url),
      "utf8",
    );
    expect(implementation).toContain(source.code);
  });

  // Historical excerpts remain in the recorded baseline. The two updated excerpts describe
  // post-baseline Flight error digests and Stream wire values instead.
  it.each(
    coreSources.filter(
      (source) =>
        source !== coreRuntimeSources.flightRuntime && source !== coreRuntimeSources.serverFnBrand,
    ),
  )("retains the $path excerpt in the architecture baseline", (source) => {
    const baselineSource = execFileSync(
      "git",
      ["show", `${architectureBaseline.commit}:${source.path}`],
      {
        cwd: new URL("../../../../", import.meta.url),
        encoding: "utf8",
      },
    );
    expect(baselineSource).toContain(source.code);
  });

  it.each(corePages)("explains $slug with current source and navigable sections", (page) => {
    const html = renderToStaticMarkup(page.content());
    expect(html).toContain("data-core-source=");
    expect(html).not.toMatch(/data-reading-excerpt|data-baseline|data-comparison/);
    expect(page.section).toBe("アーキテクチャ");
    expect(page.headings.length).toBeGreaterThanOrEqual(3);
  });
});
