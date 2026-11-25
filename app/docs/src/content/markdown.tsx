import { createMarkdownCollection, parseMarkdown } from "@effront/markdown";
import { Array, Effect, Predicate } from "effect";

import { articleCatalog } from "./catalog.ts";
import { englishArticleCatalog } from "./en/catalog.ts";
import { localizedPath } from "./locale.ts";
import type { DocLocale } from "./locale.ts";
import { defaultComponents, localizedComponents, renderDocument } from "./markdown-render.tsx";
import type { MarkdownComponents } from "./markdown-render.tsx";
import type { RenderableDocPage } from "./types.ts";

// Vite owns loading. The renderer consumes bundled Markdown source.
const articles = createMarkdownCollection({
  basePath: "/",
  documents: import.meta.glob<string>("./**/*.md", {
    base: "./articles",
    eager: true,
    import: "default",
    query: "?raw",
  }),
});

const englishArticles = createMarkdownCollection({
  basePath: "/en",
  documents: import.meta.glob<string>("./**/*.md", {
    base: "./en/articles",
    eager: true,
    import: "default",
    query: "?raw",
  }),
});

type ArticleContent = Readonly<{
  collection: typeof articles;
  components: MarkdownComponents;
  missingLabel: string;
  source: string;
}>;

const renderArticle =
  ({
    collection,
    components,
    missingLabel,
    source,
  }: ArticleContent): RenderableDocPage["content"] =>
  () =>
    Effect.gen(function* () {
      const documents = yield* collection;
      const entry = documents.get(source);
      if (Predicate.isNullish(entry)) {
        // oxlint-disable-next-line rules/require-tagged-error -- A broken static article registration retains the native TypeError reported as a defect.
        throw new TypeError(`Documentation article is missing: ${missingLabel}`);
      }
      const document = yield* parseMarkdown(entry);
      return renderDocument(document, components);
    });

export const markdownPages: Readonly<RenderableDocPage[]> = articleCatalog.map(
  ({ source, ...page }) => ({
    ...page,
    content: renderArticle({
      collection: articles,
      components: defaultComponents,
      missingLabel: source,
      source,
    }),
  }),
);

export const localizedMarkdownPages = (locale: DocLocale): Readonly<RenderableDocPage[]> => {
  const catalog = locale === "en" ? englishArticleCatalog : articleCatalog;
  const collection = locale === "en" ? englishArticles : articles;
  const basePath = locale === "en" ? "/en" : "";
  const components = localizedComponents(locale);
  return Array.map(catalog, ({ source, slug, ...metadata }) => ({
    ...metadata,
    content: renderArticle({
      collection,
      components,
      missingLabel: `${locale}${source}`,
      source: `${basePath}${source}`,
    }),
    slug: localizedPath(slug, locale),
  }));
};
