import { Array, Predicate, String } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { articleCatalog } from "./catalog.ts";
import { englishArticleCatalog } from "./en/catalog.ts";
import { documentPath, localizedPath } from "./locale.ts";
import { retainedUrls } from "./pages-retained.fixture.ts";
import { getPage, localizedNavigation, localizedPages, pages } from "./pages.ts";

const manifestJa = Object.keys(import.meta.glob("./articles/**/*.md"));
const manifestEn = Object.keys(import.meta.glob("./en/articles/**/*.md"));
const entrySources = import.meta.glob<string>("../entry.effront.tsx", {
  eager: true,
  import: "default",
  query: "?raw",
});
const routesEntry = entrySources["../entry.effront.tsx"] ?? "";
const editions = ["ja", "en"] as const;
const errorRoute = "/best-practices/server-function-error-handling";
const missingPage = "Documentation route is missing content";

describe("documentation files and published entries", () => {
  test.each([
    { catalog: articleCatalog, directory: "./articles", files: manifestJa },
    { catalog: englishArticleCatalog, directory: "./en/articles", files: manifestEn },
  ])(
    "registers every source file in $directory and preserves the root alias",
    ({ catalog, directory, files }) => {
      const sources = Array.map(catalog, (page) => `${directory}${page.source}.md`);
      expect(sources.toSorted()).toStrictEqual(files.toSorted());
      expect(catalog.find((page) => page.slug === "/")?.source).toBe("/index");
    },
  );

  test("publishes identical routes for the Japanese and English Markdown collections", () => {
    expect(Array.map(englishArticleCatalog, (page) => page.slug).toSorted()).toStrictEqual(
      Array.map(articleCatalog, (page) => page.slug).toSorted(),
    );
  });

  test.each(["/index", "/ja/index", "/en/index"])(
    "reserves the source-only index alias %s",
    (path) => {
      expect(() => getPage(path)).toThrow(missingPage);
    },
  );

  test.each(["", "/ja", "/en"])("registers the Server Function error guide at %s", (prefix) => {
    const slug = `${prefix}${errorRoute}`;
    expect(routesEntry).toContain(
      `.page(\n      "${slug}",\n      documentPage("${slug}"),\n    )`,
    );
  });
});

const isBlank = (value: string): boolean => String.isEmpty(String.trim(value));
const metadata = (item: ReturnType<typeof localizedNavigation>[number]): typeof item => {
  const { group, section, slug, title } = getPage(item.slug);
  return { ...(Predicate.isNotNullish(group) ? { group } : {}), section, slug, title };
};
const missingMetadata = ({ slug }: ReturnType<typeof localizedNavigation>[number]): boolean => {
  const page = getPage(slug);
  return [page.description, page.section, page.title].some((value) => isBlank(value));
};
const localeSlug = /^\/(?:en|ja)(?:\/[a-z-]+)*$/u;
const expectedArchitectureChapters = 7;
const retiredPaths = ["/advanced", "/advanced/production-startup", "/guide/testing"];
const invalidLocalizedPage = (page: (typeof localizedPages)[number]): boolean =>
  !localeSlug.test(page.slug) || getPage(page.slug) !== page;

describe("localized documentation navigation", () => {
  test.each(editions)(
    "publishes complete and serializable navigation metadata for %s",
    (locale) => {
      const items = localizedNavigation(locale);
      const expected = Array.map(retainedUrls, (slug) => localizedPath(slug, locale));
      const serialized = JSON.stringify(items);
      const parsed: unknown = JSON.parse(serialized);
      const chapters = Array.filter(items, (item) =>
        documentPath(item.slug).startsWith("/architecture/implementation/"),
      );
      expect(Array.map(items, (item) => item.slug).toSorted()).toStrictEqual(expected.toSorted());
      expect(parsed).toStrictEqual(items);
      expect(Array.map(items, metadata)).toStrictEqual(items);
      expect(Array.filter(items, missingMetadata)).toStrictEqual([]);
      expect(chapters).toHaveLength(expectedArchitectureChapters);
    },
  );

  test("keeps localized routes separate from the Japanese aliases", () => {
    const allPages = [...pages, ...localizedPages];
    expect(localizedPages).toHaveLength(retainedUrls.length * editions.length);
    expect(new Set(Array.map(allPages, (page) => page.slug)).size).toBe(allPages.length);
    expect(Array.filter(localizedPages, invalidLocalizedPage)).toStrictEqual([]);
  });
});

const retiredLocalizedPaths = Array.flatMap(editions, (locale) =>
  Array.map(retiredPaths, (path) => localizedPath(path, locale)),
);

describe("retired localized documentation routes", () => {
  test.each(retiredLocalizedPaths)("reports missing content for %s", (path) => {
    expect(() => getPage(path)).toThrow(missingPage);
  });
});
