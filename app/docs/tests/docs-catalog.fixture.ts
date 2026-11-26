import { articleCatalog } from "#docs/content/catalog.ts";
import { corePages } from "#docs/content/core.ts";
import type { DocPage } from "#docs/content/types.ts";
import { Data, Predicate } from "effect";

type ArticleMetadata = Omit<DocPage, "content">;

class MissingArticleMetadata extends Data.TaggedError("MissingArticleMetadata")<{
  slug: string;
}> {}

export const pages = [...articleCatalog, ...corePages] as const;

export const articleMetadata = (slug: string): ArticleMetadata => {
  const article = pages.find((candidate) => candidate.slug === slug);
  if (Predicate.isNullish(article)) {
    throw new MissingArticleMetadata({ slug });
  }
  return article;
};
