import { Array } from "effect";
import { describe, expect, test } from "vite-plus/test";

import {
  incorrectlyLocalized,
  internalTargets,
  invalidDeclaredHeadings,
  missingFragments,
  renderedHeadings,
  renderedIds,
} from "./pages-link-targets.fixture.ts";
import { render, text, textOf } from "./pages-render.fixture.ts";
import { getPage, localizedPages, pages } from "./pages.ts";

const architecture = "/architecture/implementation/";
const numberOfChapters = 7;
const invalidChapter = (page: (typeof pages)[number]): boolean =>
  page.group !== "実装解説" || !page.slug.startsWith(architecture);
const architectureTitles = [
  { locale: "en", note: "For advanced consumers and Effront developers" },
  { locale: "ja", note: "高度な使い方をする利用者や Effront の開発者" },
];

describe("published architecture chapters", () => {
  test("keeps all authored chapters under the implementation group", () => {
    const chapters = Array.filter(pages, (page) => page.section === "アーキテクチャ");
    expect(chapters).toHaveLength(numberOfChapters);
    expect(Array.filter(chapters, (page) => invalidChapter(page))).toStrictEqual([]);
    expect(Array.some(pages, (page) => page.slug.startsWith("/reading/"))).toBe(false);
  });

  test.each(architectureTitles)(
    "describes the intended audience on the $locale home page",
    async ({ locale, note }) => {
      await expect(text(`/${locale}`)).resolves.toContain(note);
    },
  );
});

const englishChapters = Array.filter(localizedPages, (page) =>
  page.slug.startsWith(`/en${architecture}`),
);
const sourceFigure =
  /<figure\b[^>]*data-core-source="(?<path>[^"]+)"[^>]*>(?<figure>[\s\S]*?)<\/figure>/gu;
const figureCaption = /<figcaption\b[^>]*>(?<caption>[\s\S]*?)<\/figcaption>/u;
type Excerpt = Readonly<{ caption: string; path: string }>;
const missingCaption = ({ caption, path }: Excerpt): boolean =>
  caption !== `Excerpt from ${path}` && caption !== `${path} excerpt`;

const extractExcerpts = (html: string): Excerpt[] => {
  const figures = Array.fromIterable(html.matchAll(sourceFigure));
  return Array.map(figures, ({ groups }) => {
    const caption = figureCaption.exec(groups?.["figure"] ?? "")?.groups?.["caption"] ?? "";
    return { caption: textOf(caption).trim(), path: groups?.["path"] ?? "" };
  });
};

describe("english source excerpt labels", () => {
  test.each(englishChapters)("$slug labels every source excerpt", async (page) => {
    const html = await render(page.slug);
    const excerpts = extractExcerpts(html);
    expect(excerpts).not.toHaveLength(0);
    expect(Array.filter(excerpts, (excerpt) => missingCaption(excerpt))).toStrictEqual([]);
  });
});

describe("documentation route validation", () => {
  test.each(["/not-a-document", "/en/not-a-document", "/ja/not-a-document", "/fr/guide/routes"])(
    "reports missing content at %s",
    (slug) => {
      expect(() => getPage(slug)).toThrow(`Documentation route is missing content: ${slug}`);
    },
  );

  test.each([...pages, ...localizedPages])(
    "$slug renders the declared headings and valid internal links",
    async (page) => {
      const html = await render(page.slug);
      const ids = renderedIds(html);
      const declared = Array.map(page.headings, (heading) => heading.id);
      const linked = internalTargets(html, page.slug);
      expect(declared).not.toHaveLength(0);
      expect(new Set(ids).size).toBe(ids.length);
      expect(renderedHeadings(html)).toStrictEqual(declared);
      expect({
        invalidHeadings: invalidDeclaredHeadings(declared, ids),
        invalidLinks: incorrectlyLocalized(linked, page.slug),
      }).toStrictEqual({ invalidHeadings: [], invalidLinks: [] });
      await expect(missingFragments(linked, { html, slug: page.slug })).resolves.toStrictEqual([]);
    },
  );
});
