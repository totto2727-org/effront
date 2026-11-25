import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";

import { localizedPath } from "#docs/content/locale.ts";
import type { DocLocale } from "#docs/content/locale.ts";
import { DocsShell } from "./docs-shell.tsx";
import type { DocsShellProps } from "./docs-shell.tsx";

const introduction = { section: "Guide", slug: "/guide", title: "はじめに" };
const chapter = {
  group: "実装解説",
  section: "アーキテクチャ",
  slug: "/architecture/implementation/runtime",
  title: "ランタイムとリクエストのライフサイクル",
};
const nextChapter = { ...chapter, slug: "/architecture/implementation/flight", title: "Flight" };
const japaneseNavigation = [introduction, chapter, nextChapter];
const englishIntroduction = { section: "Guides", slug: "/en/guide", title: "Introduction" };
const englishChapter = {
  group: "Implementation",
  section: "Architecture",
  slug: "/en/architecture/implementation/runtime",
  title: "Runtime and request lifetime",
};
const englishNextChapter = {
  ...englishChapter,
  slug: "/en/architecture/implementation/flight",
  title: "Flight",
};
const englishNavigation = [englishIntroduction, englishChapter, englishNextChapter];
const requestHeadings = [{ id: "request-lifetime", title: "Request lifetime" }];
const noHeadings: DocsShellProps["headings"] = [];

const render = (
  current: DocsShellProps["current"],
  {
    headings = noHeadings,
    locale,
    navigation = japaneseNavigation,
  }: Partial<Omit<DocsShellProps, "current" | "children">> = {},
): string =>
  renderToStaticMarkup(
    <DocsShell current={current} headings={headings} locale={locale} navigation={navigation}>
      <h1>{current.title}</h1>
    </DocsShell>,
  );

const sidebar = (html: string): string => {
  const [beforeHeader = ""] = html.split('<header class="sticky');
  return beforeHeader;
};

const nav = (html: string, label: string): string =>
  new RegExp(`<nav aria-label="${label}"[^>]*>(?<markup>.*?)</nav>`, "u").exec(html)?.groups?.[
    "markup"
  ] ?? "";

const noscript = (html: string): string =>
  /<noscript>(?<markup>.*?)<\/noscript>/u.exec(html)?.groups?.["markup"] ?? "";

const assertContains = (html: string, expected: Readonly<string[]>): void => {
  expect(expected.filter((fragment) => !html.includes(fragment))).toStrictEqual([]);
};

describe("documentation navigation in Japanese", () => {
  test("nests Japanese chapters under their metadata group and marks the active link", () => {
    const markup = sidebar(render(chapter));
    expect(markup).toMatch(
      /<ul[^>]+aria-label="アーキテクチャ"><li[^>]*><span[^>]*>実装解説<\/span><ul/u,
    );
    expect(markup.match(/aria-label="実装解説"/gu)).toHaveLength(1);
    expect(markup).toMatch(/aria-label="Guide"><li[^>]*><a/u);
    assertContains(markup, [
      `href="${chapter.slug}" aria-current="page"`,
      `href="${nextChapter.slug}"`,
      "h-auto",
    ]);
  });

  test("renders an ordered breadcrumb including only the current page's ancestors", () => {
    const grouped = nav(render(chapter), "パンくずリスト");
    expect(grouped).toMatch(/<ol.*アーキテクチャ.*実装解説.*aria-current="page".*ランタイム/u);
    const ungrouped = nav(render(introduction), "パンくずリスト");
    expect(ungrouped).toContain("Guide");
    expect(ungrouped).not.toContain("実装解説");
  });

  test("preserves no-JavaScript chapter links and the official upstream footer", () => {
    const html = render(chapter);
    const fallback = noscript(html);
    expect(fallback).toContain(`href="${chapter.slug}" aria-current="page"`);
    expect(fallback).toContain(`アーキテクチャ: 実装解説: ${chapter.title}`);
    expect(html).toContain('href="https://effective-rsc.nikhilsnayak.dev/"');
    expect(html).not.toContain("github.com");
  });
});

describe("documentation navigation in English", () => {
  test("renders English shell labels, grouped navigation, breadcrumbs, and table of contents", () => {
    const html = render(englishChapter, {
      headings: requestHeadings,
      locale: "en",
      navigation: englishNavigation,
    });
    assertContains(html, [
      "Skip to content",
      "Filter guides",
      'placeholder="Search guides"',
      'aria-label="Breadcrumbs"',
      "Documentation",
      'aria-label="On this page"',
      'aria-label="Previous and next pages"',
      "Previous page",
      "Next page",
      "effective-rsc website",
      'href="#request-lifetime"',
      "Request lifetime",
    ]);
    expect(html).not.toMatch(/パンくずリスト|ガイドを検索/u);
    const markup = sidebar(html);
    expect(markup).toMatch(
      /<ul[^>]+aria-label="Architecture"><li[^>]*><span[^>]*>Implementation<\/span><ul/u,
    );
    expect(markup.match(/aria-label="Implementation"/gu)).toHaveLength(1);
    assertContains(markup, [`href="${englishChapter.slug}" aria-current="page"`, 'href="/en"']);
    expect(nav(html, "Breadcrumbs")).toMatch(
      /<ol.*Architecture.*Implementation.*aria-current="page".*Runtime and request lifetime/u,
    );
  });

  test("keeps English no-JavaScript and previous/next links in the same language", () => {
    const html = render(englishChapter, { locale: "en", navigation: englishNavigation });
    assertContains(noscript(html), [
      'aria-label="Documentation navigation"',
      `href="${englishChapter.slug}" aria-current="page"`,
      `Architecture: Implementation: ${englishChapter.title}`,
      ...englishNavigation.map((item) => `href="${item.slug}"`),
    ]);
    const adjacent = nav(html, "Previous and next pages");
    assertContains(adjacent, [
      `href="${englishIntroduction.slug}"`,
      `href="${englishNextChapter.slug}"`,
    ]);
    expect(adjacent).not.toContain(`href="${englishChapter.slug}"`);
  });
});

const switchedPaths = ["/", "/guide/routes", "/architecture/implementation/request"];
const locales: Readonly<{ label: string; locale: DocLocale }[]> = [
  { label: "言語", locale: "ja" },
  { label: "Language", locale: "en" },
];

type LinkExpectation = Readonly<{
  active: boolean;
  label: string;
  language: DocLocale;
  path: string;
}>;

const verifyLanguageLink = (
  links: Readonly<string[]>,
  { active, label, language, path }: LinkExpectation,
): void => {
  const link =
    links.find((anchor) => anchor.includes(`href="${localizedPath(path, language)}"`)) ?? "";
  assertContains(link, [`lang="${language}"`, `>${label}</a>`]);
  expect(link).toMatch(new RegExp(`\\bhreflang="${language}"`, "iu"));
  expect(link.includes('aria-current="true"')).toBe(active);
  expect(link.includes("aria-current=")).toBe(active);
};

describe("documentation language switcher", () => {
  test.each(locales)(
    "switches the current $locale article and homepage with accessible language links",
    ({ label, locale }) => {
      expect.hasAssertions();
      switchedPaths.forEach((path) => {
        const current = { ...englishChapter, slug: localizedPath(path, locale) };
        const html = render(current, { locale, navigation: [current] });
        const markup = nav(html, label);
        const links = [...markup.matchAll(/<a\b[^>]*>[^<]*<\/a>/gu)].map((match) => match[0]);
        expect(links).toHaveLength(2);
        verifyLanguageLink(links, {
          active: locale === "en",
          label: "English",
          language: "en",
          path,
        });
        verifyLanguageLink(links, {
          active: locale === "ja",
          label: "日本語",
          language: "ja",
          path,
        });
      });
    },
  );

  test("offers both explicit locale URLs from a legacy Japanese article", () => {
    const markup = nav(render(chapter), "言語");
    assertContains(markup, [`href="/en${chapter.slug}"`, `href="/ja${chapter.slug}"`]);
    expect(markup).toContain('aria-current="true"');
  });
});
