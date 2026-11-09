import { Effect } from "effect";
import type { RenderableDocPage } from "./types";
import { markdownPages, localizedMarkdownPages } from "./markdown";
import { corePages } from "./core";
import { englishCorePages } from "./en/core";
import { localizedPath, type DocLocale } from "./locale";

export const pages: readonly RenderableDocPage[] = [
  ...markdownPages,
  ...corePages.map(({ content, ...page }) => ({ ...page, content: () => Effect.sync(content) })),
];

export const localizedPages: readonly RenderableDocPage[] = (["ja", "en"] as const).flatMap(
  (locale) => [
    ...localizedMarkdownPages(locale),
    ...(locale === "en" ? englishCorePages : corePages).map(({ content, ...page }) => ({
      ...page,
      slug: localizedPath(page.slug, locale),
      content: () => Effect.sync(content),
    })),
  ],
);

function pageNavigation(items: readonly RenderableDocPage[]) {
  return items.map(({ slug, title, section, group }) => ({
    slug,
    title,
    section,
    ...(group ? { group } : {}),
  }));
}

export const navigation = pageNavigation(pages);
export function localizedNavigation(locale: DocLocale) {
  return pageNavigation(
    localizedPages.filter(
      (page) => page.slug === `/${locale}` || page.slug.startsWith(`/${locale}/`),
    ),
  );
}

export function getPage(slug: string) {
  const canonicalSlug = slug.replace(/\/+$/, "") || "/";
  const page = [...pages, ...localizedPages].find((candidate) => candidate.slug === canonicalSlug);
  if (!page) throw new TypeError(`Documentation route is missing content: ${slug}`);
  return page;
}
