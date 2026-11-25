import { Array } from "effect";
import { describe, expect, test } from "vite-plus/test";

import {
  installationExamples,
  missingReadmes,
  packageExportNames,
} from "./pages-package-sources.fixture.ts";
import { render } from "./pages-render.fixture.ts";

const publishedRoutes = ["/api-reference", "/ja/api-reference", "/en/api-reference"];

describe("public package exports and installed versions", () => {
  test.each(publishedRoutes)("%s indexes every public code export", async (slug) => {
    const html = await render(slug);
    expect(html).toContain("peerDependencies");
    expect(html).toContain("lockfile");
    expect(html).not.toMatch(/\b\d+\.\d+\.\d+\b/u);
    expect(packageExportNames).not.toHaveLength(0);
    expect(Array.filter(packageExportNames, (name) => html.includes(name))).toStrictEqual(
      packageExportNames,
    );
  });

  test("keeps ordinary installation examples unversioned in both locales and package READMEs", () => {
    const { commands, pinned } = installationExamples();
    expect(missingReadmes).toStrictEqual([]);
    expect(commands).not.toHaveLength(0);
    expect(pinned).toStrictEqual([]);
  });
});
