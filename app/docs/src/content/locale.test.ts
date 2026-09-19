import { Effect } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";
import { documentLocale, documentPath, localizedPath, localizeDocumentLink } from "./locale";
import { localizedMarkdownPages, markdownPages } from "./markdown";

// Keep the Japanese article available, but point its English metadata at a missing source.
// A loader that silently falls back to the Japanese article must fail this test.
vi.mock("./en/catalog", async (importOriginal) => {
  const original = await importOriginal<typeof import("./en/catalog")>();
  return {
    ...original,
    englishArticleCatalog: original.englishArticleCatalog.map((page) =>
      page.slug === "/guide/routes" ? { ...page, source: "/missing-english-translation" } : page,
    ),
  };
});

describe("documentation locale paths", () => {
  it.each([
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

  it.each(["/", "/guide/routes", "/architecture/implementation/request"])(
    "%s switches languages without duplicating prefixes or losing the article path",
    (path) => {
      for (const locale of ["ja", "en"] as const) {
        const expected = `/${locale}${path === "/" ? "" : path}`;
        for (const source of [path, localizedPath(path, "ja"), localizedPath(path, "en")]) {
          expect(localizedPath(source, locale)).toBe(expected);
          expect(documentPath(localizedPath(source, locale))).toBe(path);
          expect(documentLocale(localizedPath(source, locale))).toBe(locale);
        }
      }
    },
  );

  it.each(["ja", "en"] as const)(
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

  it.each([
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

  it("does not mistake a locale-like article name for an existing prefix", () => {
    expect(localizeDocumentLink("/english", "en")).toBe("/en/english");
    expect(localizeDocumentLink("/japanese", "ja")).toBe("/ja/japanese");
  });
});

describe("missing English article", () => {
  it("fails instead of serving available Japanese content", async () => {
    const legacy = markdownPages.find((page) => page.slug === "/guide/routes");
    const japanese = localizedMarkdownPages("ja").find((page) => page.slug === "/ja/guide/routes");
    const english = localizedMarkdownPages("en").find((page) => page.slug === "/en/guide/routes");
    expect(legacy).toBeDefined();
    expect(japanese).toBeDefined();
    expect(english).toBeDefined();
    await expect(Effect.runPromise(legacy!.content())).resolves.toBeDefined();
    await expect(Effect.runPromise(japanese!.content())).resolves.toBeDefined();
    await expect(Effect.runPromise(english!.content())).rejects.toThrow(
      "Documentation article is missing: en/missing-english-translation",
    );
  });
});
