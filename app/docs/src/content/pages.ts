import { Array, Effect, Option, Predicate, String } from "effect";

import { corePages } from "./core.ts";
import { englishCorePages } from "./en/core.ts";
import { localizedPath } from "./locale.ts";
import type { DocLocale } from "./locale.ts";
import { localizedMarkdownPages, markdownPages } from "./markdown.tsx";
import type { DocPage, RenderableDocPage } from "./types.ts";

const renderStaticPage = (
  { content, ...metadata }: DocPage,
  slug = metadata.slug,
): RenderableDocPage => ({ ...metadata, content: () => Effect.sync(content), slug });

export const pages: Readonly<RenderableDocPage[]> = [
  ...markdownPages,
  ...Array.map(corePages, (page) => renderStaticPage(page)),
];

export const localizedPages: Readonly<RenderableDocPage[]> = Array.flatMap(
  ["ja", "en"] as const,
  (locale) => [
    ...localizedMarkdownPages(locale),
    ...Array.map(locale === "en" ? englishCorePages : corePages, (page) =>
      renderStaticPage(page, localizedPath(page.slug, locale)),
    ),
  ],
);

type NavigationItem = Pick<DocPage, "group" | "section" | "slug" | "title">;

const pageNavigation = (items: Readonly<RenderableDocPage[]>): NavigationItem[] =>
  Array.map(items, ({ group, section, slug, title }) => ({
    ...(Predicate.isString(group) && !String.isEmpty(group) ? { group } : {}),
    section,
    slug,
    title,
  }));

export const navigation = pageNavigation(pages);

export const localizedNavigation = (locale: DocLocale): NavigationItem[] => {
  const root = `/${locale}`;
  const items = Array.filter(
    localizedPages,
    (page) => page.slug === root || String.startsWith(`${root}/`)(page.slug),
  );
  return pageNavigation(items);
};

export const getPage = (slug: string): RenderableDocPage => {
  const path = slug.replace(/\/+$/u, "");
  const canonicalSlug = String.isEmpty(path) ? "/" : path;
  const page = Array.findFirst(
    [...pages, ...localizedPages],
    (candidate) => candidate.slug === canonicalSlug,
  );
  return Option.getOrThrowWith(
    page,
    () =>
      // oxlint-disable-next-line rules/require-tagged-error -- Preserve the native TypeError for an invalid documentation route registration.
      new TypeError(`Documentation route is missing content: ${slug}`),
  );
};
