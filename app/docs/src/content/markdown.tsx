import type { ComponentProps } from "react";
import { MarkdownDocument } from "@comark/react/components/MarkdownDocument";
import { createMarkdownCollection, parseMarkdown } from "@effront/markdown";
import { Effect } from "effect";
import { articleCatalog } from "./catalog";
import { englishArticleCatalog } from "./en/catalog";
import { localizedPath, localizeDocumentLink, type DocLocale } from "./locale";
import type { RenderableDocPage } from "./types";

// Vite owns loading. No runtime filesystem access or client-side parser is needed.
const articles = createMarkdownCollection({
  basePath: "/",
  documents: import.meta.glob<string>("./**/*.md", {
    base: "./articles",
    query: "?raw",
    import: "default",
    eager: true,
  }),
});

const englishArticles = createMarkdownCollection({
  basePath: "/en",
  documents: import.meta.glob<string>("./**/*.md", {
    base: "./en/articles",
    query: "?raw",
    import: "default",
    eager: true,
  }),
});

// Preserve keyboard access to scrollable code while using Comark's standard tokens.
function MarkdownPre({
  children,
  className,
  language,
}: ComponentProps<"pre"> & { language?: string }) {
  return (
    <pre className={className} data-code-block="" data-language={language ?? "text"} tabIndex={0}>
      {children}
    </pre>
  );
}

export const markdownPages: readonly RenderableDocPage[] = articleCatalog.map(
  ({ source, ...page }) => ({
    ...page,
    content: () =>
      Effect.gen(function* () {
        const collection = yield* articles;
        const entry = collection.get(source);
        if (!entry) throw new TypeError(`Documentation article is missing: ${source}`);
        const document = yield* parseMarkdown(entry);
        return (
          <MarkdownDocument
            value={document}
            className="docs-markdown"
            components={{ ProsePre: MarkdownPre }}
          />
        );
      }),
  }),
);

export function localizedMarkdownPages(locale: DocLocale): readonly RenderableDocPage[] {
  const catalog = locale === "en" ? englishArticleCatalog : articleCatalog;
  function ArticleLink({ href, ...props }: ComponentProps<"a">) {
    return <a {...props} href={localizeDocumentLink(href, locale)} />;
  }
  return catalog.map(({ source, ...page }) => ({
    ...page,
    slug: localizedPath(page.slug, locale),
    content: () =>
      Effect.gen(function* () {
        const collection = yield* locale === "en" ? englishArticles : articles;
        const entry = collection.get(`${locale === "en" ? "/en" : ""}${source}`);
        if (!entry) throw new TypeError(`Documentation article is missing: ${locale}${source}`);
        const document = yield* parseMarkdown(entry);
        return (
          <MarkdownDocument
            value={document}
            className="docs-markdown"
            components={{ ProsePre: MarkdownPre, ProseA: ArticleLink }}
          />
        );
      }),
  }));
}
