import { articleCatalog } from "#docs/content/catalog.ts";
import { corePages } from "#docs/content/core.ts";
import { englishArticleCatalog } from "#docs/content/en/catalog.ts";
import { englishCorePages } from "#docs/content/en/core.ts";
import { Data, Predicate } from "effect";

// Import metadata directly. content/pages also loads the Vite-only Markdown glob.
const english = {
  contentDirectory: "en/articles",
  labels: {
    breadcrumbs: "Breadcrumbs",
    empty: "No guides match your search.",
    language: "Language",
    navigation: "Documentation navigation",
    previousNext: "Previous and next pages",
    search: "Filter guides",
    toc: "On this page",
  },
  locale: "en",
  pages: [...englishArticleCatalog, ...englishCorePages],
} as const;

const japanese = {
  contentDirectory: "articles",
  labels: {
    breadcrumbs: "パンくずリスト",
    empty: "一致するガイドはありません。",
    language: "言語",
    navigation: "ドキュメントナビゲーション",
    previousNext: "前後のページ",
    search: "ガイドを絞り込む",
    toc: "このページ内",
  },
  locale: "ja",
  pages: [...articleCatalog, ...corePages],
} as const;

export const locales = [english, japanese] as const;
export type LocaleDocs = (typeof locales)[number];
export type LocaleArticle = LocaleDocs["pages"][number];

export const retiredArticles = [
  { canonical: "/platforms", fragment: "#bun", retired: "/platforms/node-bun" },
  { canonical: "/platforms", fragment: "", retired: "/advanced/production-startup" },
  { canonical: "/best-practices/testing", fragment: "#production", retired: "/guide/testing" },
];

class MissingLocalizedArticle extends Data.TaggedError("MissingLocalizedArticle")<{
  locale: LocaleDocs["locale"];
  slug: string;
}> {}

// Build public URLs independently of the production locale helpers.
export const localizedUrl = (docs: LocaleDocs, slug: string): string =>
  `/${docs.locale}${slug === "/" ? "" : slug}`;

export const localizedSlugs = (docs: LocaleDocs): string[] =>
  docs.pages.map((article) => localizedUrl(docs, article.slug));

export const metadata = (docs: LocaleDocs, slug: string): LocaleArticle => {
  const article = docs.pages.find((candidate) => candidate.slug === slug);
  if (Predicate.isNullish(article)) {
    throw new MissingLocalizedArticle({ locale: docs.locale, slug });
  }
  return article;
};

export const otherLocale = (docs: LocaleDocs): LocaleDocs =>
  docs.locale === "en" ? japanese : english;
