import { describe, expect, it, test } from "@effect/vitest";
import { Array, Cause, Effect, Exit } from "effect";
import { vi } from "vite-plus/test";

import { documentLocale, documentPath, localizedPath, localizeDocumentLink } from "./locale.ts";
import { localizedMarkdownPages, markdownPages } from "./markdown.tsx";
import type { RenderableDocPage } from "./types.ts";

// Keep the Japanese article available while its English metadata points to a missing source.
vi.mock(import("./en/catalog.ts"), async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    englishArticleCatalog: Array.map(original.englishArticleCatalog, (page) =>
      page.slug === "/guide/routes" ? { ...page, source: "/missing-english-translation" } : page,
    ),
  };
});

const languagePaths = [
  { en: "/en", ja: "/ja", path: "/" },
  { en: "/en/guide/routes", ja: "/ja/guide/routes", path: "/guide/routes" },
  {
    en: "/en/architecture/implementation/request",
    ja: "/ja/architecture/implementation/request",
    path: "/architecture/implementation/request",
  },
];
const supportedLocales = ["ja", "en"] as const;
const languageSwitches = languagePaths.flatMap(({ en, ja, path }) => {
  const destinations = { en, ja };
  return supportedLocales.flatMap((locale) =>
    [path, ja, en].map((source) => ({ expected: destinations[locale], locale, path, source })),
  );
});

describe("documentation locale paths", () => {
  test.each([
    ["/", "ja", "/"],
    ["/guide/routes", "ja", "/guide/routes"],
    ["/ja", "ja", "/"],
    ["/ja/", "ja", "/"],
    ["/ja/guide/routes", "ja", "/guide/routes"],
    ["/en", "en", "/"],
    ["/en/", "en", "/"],
    ["/en/guide/routes", "en", "/guide/routes"],
    ["/english/guide", "ja", "/english/guide"],
    ["/japanese/guide", "ja", "/japanese/guide"],
    ["/fr/guide/routes", "ja", "/fr/guide/routes"],
  ])("%s identifies only a complete locale prefix", (pathname, locale, path) => {
    expect(documentLocale(pathname)).toBe(locale);
    expect(documentPath(pathname)).toBe(path);
  });

  test.each(languageSwitches)(
    "switches $source to $locale without duplicating prefixes or losing the article path",
    ({ expected, locale, path, source }) => {
      const localized = localizedPath(source, locale);
      expect(localized).toBe(expected);
      expect(documentPath(localized)).toBe(path);
      expect(documentLocale(localized)).toBe(locale);
    },
  );
});

describe("locale-aware article links", () => {
  test.each(supportedLocales)(
    "localizes root-relative article links in %s while preserving queries and anchors",
    (locale) => {
      expect(localizeDocumentLink("/", locale)).toBe(`/${locale}`);
      expect(localizeDocumentLink("/guide/routes", locale)).toBe(`/${locale}/guide/routes`);
      expect(localizeDocumentLink("/guide/routes?view=all#params", locale)).toBe(
        `/${locale}/guide/routes?view=all#params`,
      );
      expect(localizeDocumentLink("/#overview", locale)).toBe(`/${locale}/#overview`);
    },
  );

  test.each([
    undefined,
    "",
    "#params",
    "?view=all#params",
    "./routes.md#params",
    "https://effect.website/docs/",
    "mailto:docs@example.com",
    "//example.com/guide/routes",
    "/en",
    "/ja",
    "/en#overview",
    "/ja?view=all",
    "/en/guide/routes#params",
    "/ja/guide/routes#params",
  ])("preserves explicit locale and non-document link %s", (href) => {
    expect(localizeDocumentLink(href, "ja")).toBe(href);
    expect(localizeDocumentLink(href, "en")).toBe(href);
  });

  test("does not mistake a locale-like article name for an existing prefix", () => {
    expect(localizeDocumentLink("/english", "en")).toBe("/en/english");
    expect(localizeDocumentLink("/japanese", "ja")).toBe("/ja/japanese");
  });
});

const findArticle = (
  pages: Readonly<RenderableDocPage[]>,
  slug: string,
): Effect.Effect<RenderableDocPage, Cause.NoSuchElementError> =>
  Effect.fromNullishOr(pages.find((page) => page.slug === slug));

describe("missing English article", () => {
  it.effect("renders the available Japanese article with and without the locale prefix", () =>
    Effect.gen(function* () {
      const legacy = yield* findArticle(markdownPages, "/guide/routes");
      const japanese = yield* findArticle(localizedMarkdownPages("ja"), "/ja/guide/routes");
      const legacyContent = yield* legacy.content();
      const japaneseContent = yield* japanese.content();
      expect(legacyContent).toBeDefined();
      expect(japaneseContent).toBeDefined();
    }),
  );

  it.effect("fails instead of serving available Japanese content", () =>
    Effect.gen(function* () {
      const english = yield* findArticle(localizedMarkdownPages("en"), "/en/guide/routes");
      const exit = yield* Effect.exit(english.content());
      expect(Exit.isFailure(exit)).toBe(true);
      const error = Exit.match(exit, {
        onFailure: Cause.squash,
        onSuccess: () => "Expected the English article to fail.",
      });
      expect(error).toBeInstanceOf(TypeError);
      expect(error).toHaveProperty(
        "message",
        "Documentation article is missing: en/missing-english-translation",
      );
    }),
  );
});
