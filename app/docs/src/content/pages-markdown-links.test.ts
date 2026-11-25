// oxlint-disable-next-line rules/no-node-imports -- Resolve actual repository-relative links and verify the retired package file is absent.
import { access, readFile } from "node:fs/promises";

import { Array } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { localizedPages } from "./pages.ts";

const repository = new URL("../../../../", import.meta.url);
const publishedOrigin = "https://effront.totto2727.dev";
const packageReadme = "packages/markdown/README.md";
const readers = [
  "README.md",
  "docs/INDEX.md",
  "examples/AGENTS.md",
  "app/docs/docs/AUTHORING.md",
  packageReadme,
  "packages/markdown/AGENTS.md",
  "packages/markdown/docs/IMPLEMENTATION.md",
];
const markdownLink = /\]\((?<target>[^)]+)\)/gu;
const retiredLocalLink = /\]\((?:\.\/)?(?:docs\/)?GUIDE\.md(?:[#)]|$)/u;
const externalOrAnchor = /^[a-z]+:|^#/u;
const knownPaths = new Set(Array.map(localizedPages, (page) => page.slug));

const readLinks = (source: string): string[] => {
  const links = Array.fromIterable(source.matchAll(markdownLink));
  return Array.map(links, ({ groups }) => groups?.["target"] ?? "");
};
const oldGuideLink = (file: string, source: string): boolean =>
  source.includes("markdown/docs/GUIDE.md") ||
  (file.startsWith("packages/markdown/") && retiredLocalLink.test(source));
const isLocalMarkdown = (href: string): boolean =>
  href.includes("markdown") && !externalOrAnchor.test(href);
const isPublished = (href: string): boolean => href.includes("effront.totto2727.dev");

const unknownPublishedUrl = (href: string): boolean => {
  const target = new URL(href);
  return target.origin !== publishedOrigin || !knownPaths.has(target.pathname);
};

const exists = async (url: URL): Promise<boolean> => {
  try {
    await access(url);
    return true;
  } catch {
    return false;
  }
};

const missingRelativeLinks = async (file: URL, urls: string[]): Promise<string[]> => {
  const links = Array.filter(urls, (href) => !isPublished(href) && isLocalMarkdown(href));
  const checked = await Promise.all(
    Array.map(links, async (href) => {
      const source = new URL(href.split("#")[0] ?? "", file);
      return { found: await exists(source), href };
    }),
  );
  return Array.map(
    Array.filter(checked, ({ found }) => !found),
    ({ href }) => href,
  );
};

describe("maintained Markdown documentation links", () => {
  test.each(readers)("%s links readers to live documentation", async (path) => {
    const file = new URL(path, repository);
    const source = await readFile(file, "utf8");
    const urls = readLinks(source);
    const published = Array.filter(urls, (url) => isPublished(url));
    expect(oldGuideLink(path, source)).toBe(false);
    expect(Array.filter(published, (url) => unknownPublishedUrl(url))).toStrictEqual([]);
    await expect(missingRelativeLinks(file, urls)).resolves.toStrictEqual([]);
  });

  test("keeps the Markdown README as the canonical entry point", async () => {
    const source = await readFile(new URL(packageReadme, repository), "utf8");
    expect(source).toContain(`${publishedOrigin}/en/guide/markdown`);
    expect(source).toContain(`${publishedOrigin}/en/api-reference/markdown`);
    await expect(
      access(new URL("packages/markdown/docs/GUIDE.md", repository)),
    ).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
