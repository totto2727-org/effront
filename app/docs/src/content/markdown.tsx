import type { ComponentProps } from "react";
import { MarkdownDocument } from "@comark/react/components/MarkdownDocument";
import { createMarkdownCollection, parseMarkdown } from "@effront/markdown";
import { Cache, Duration, Effect, Exit } from "effect";
import { articleCatalog } from "./catalog";
import { englishArticleCatalog } from "./en/catalog";
import { localizedPath, localizeDocumentLink, type DocLocale } from "./locale";
import type { RenderableDocPage } from "./types";
import { markdownAlertComponents } from "../components/markdown-alert";
import { createMarkdownDocumentCache } from "./markdown-cache";

// Vite owns loading. No runtime filesystem access or client-side parser is needed.
const articles = Effect.runSync(
  Cache.makeWith(
    () =>
      createMarkdownCollection({
        basePath: "/",
        documents: import.meta.glob<string>("./**/*.md", {
          base: "./articles",
          query: "?raw",
          import: "default",
          eager: true,
        }),
      }),
    {
      capacity: 1,
      timeToLive: (exit) => (Exit.isSuccess(exit) ? Duration.infinity : Duration.zero),
    },
  ),
);

const englishArticles = Effect.runSync(
  Cache.makeWith(
    () =>
      createMarkdownCollection({
        basePath: "/en",
        documents: import.meta.glob<string>("./**/*.md", {
          base: "./en/articles",
          query: "?raw",
          import: "default",
          eager: true,
        }),
      }),
    {
      capacity: 1,
      timeToLive: (exit) => (Exit.isSuccess(exit) ? Duration.infinity : Duration.zero),
    },
  ),
);

// A parser configuration change recreates this module-level cache, so documents
// from a prior parser configuration are never reused.
const parseDocumentationMarkdown = createMarkdownDocumentCache(parseMarkdown);

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
        const collection = yield* Cache.get(articles, undefined);
        const entry = collection.get(source);
        if (!entry) throw new TypeError(`Documentation article is missing: ${source}`);
        const document = yield* parseDocumentationMarkdown(entry);
        return (
          <MarkdownDocument
            value={document}
            className="docs-markdown"
            components={{ ...markdownAlertComponents, ProsePre: MarkdownPre }}
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
        const collection = yield* Cache.get(
          locale === "en" ? englishArticles : articles,
          undefined,
        );
        const entry = collection.get(`${locale === "en" ? "/en" : ""}${source}`);
        if (!entry) throw new TypeError(`Documentation article is missing: ${locale}${source}`);
        const document = yield* parseDocumentationMarkdown(entry);
        return (
          <MarkdownDocument
            value={document}
            className="docs-markdown"
            components={{ ...markdownAlertComponents, ProsePre: MarkdownPre, ProseA: ArticleLink }}
          />
        );
      }),
  }));
}
