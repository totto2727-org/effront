import { Array, Predicate } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { retainedUrls } from "./pages-retained.fixture.ts";
import { getPage, navigation, pages } from "./pages.ts";

const publishedSlug = /^\/(?:[a-z-]+(?:\/[a-z-]+)*)?$/u;
const sections = [
  "Getting started",
  "Platforms",
  "Guides",
  "Best practices",
  "API reference",
  "アーキテクチャ",
];
const invalidRoute = (page: (typeof pages)[number]): boolean =>
  !publishedSlug.test(page.slug) || getPage(page.slug) !== page;

const navigationItem = ({
  group,
  section,
  slug,
  title,
}: (typeof pages)[number]): (typeof navigation)[number] => ({
  ...(Predicate.isNotNullish(group) ? { group } : {}),
  section,
  slug,
  title,
});

describe("published documentation routing", () => {
  test("preserves published URLs and unique serializable navigation metadata", () => {
    const slugs = Array.map(pages, (page) => page.slug);
    const serialized = JSON.stringify(navigation);
    const parsed: unknown = JSON.parse(serialized);
    const registered = Array.map(pages, ({ slug }) =>
      navigation.find((item) => item.slug === slug),
    );
    expect(slugs.toSorted()).toStrictEqual(retainedUrls.toSorted());
    expect(new Set(slugs).size).toBe(pages.length);
    expect(parsed).toStrictEqual(navigation);
    expect({
      invalid: Array.filter(pages, invalidRoute),
      sections: Array.dedupe(Array.map(pages, (page) => page.section)),
    }).toStrictEqual({ invalid: [], sections });
    expect(registered).toStrictEqual(Array.map(pages, navigationItem));
  });

  test("removes the retired startup article from the catalog and navigation", () => {
    const retired = "/advanced/production-startup";
    expect(Array.map(pages, (page) => page.slug)).not.toContain(retired);
    expect(Array.map(navigation, (page) => page.slug)).not.toContain(retired);
    expect(() => getPage(retired)).toThrow("Documentation route is missing content");
  });
});
