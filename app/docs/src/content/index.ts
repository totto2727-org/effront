import { Effect } from "effect";
import type { RenderableDocPage } from "./types";
import { markdownPages } from "./markdown";
import { corePages } from "./core";

export const pages: readonly RenderableDocPage[] = [
  ...markdownPages,
  ...corePages.map(({ content, ...page }) => ({ ...page, content: () => Effect.sync(content) })),
];
export const navigation = pages.map(({ slug, title, section, group }) => ({
  slug,
  title,
  section,
  ...(group ? { group } : {}),
}));

export function getPage(slug: string) {
  const page = pages.find((candidate) => candidate.slug === slug);
  if (!page) throw new TypeError(`Documentation route is missing content: ${slug}`);
  return page;
}
