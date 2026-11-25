import type { JSX, ReactNode } from "react";

import { DocsShell } from "./components/docs-shell.tsx";
import type { DocsShellProps } from "./components/docs-shell.tsx";
import { architectureBaseline } from "./content/architecture-baseline.ts";
import { documentLocale, hasDocumentLocale } from "./content/locale.ts";
import type { DocLocale } from "./content/locale.ts";
import { getPage, localizedNavigation, navigation } from "./content/pages.ts";
import type { RenderableDocPage } from "./content/types.ts";

const renderDocumentHead = (): JSX.Element => (
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
);

const navigationItem = ({
  group,
  section,
  slug,
  title,
}: RenderableDocPage): DocsShellProps["current"] => ({ group, section, slug, title });

const renderDocumentBody = (
  pathname: string,
  locale: DocLocale,
  children: ReactNode,
): JSX.Element => {
  // The shared shell keeps its client state while the request refreshes page metadata.
  const page = getPage(pathname);
  const current = navigationItem(page);
  const pages = hasDocumentLocale(pathname) ? localizedNavigation(locale) : navigation;
  return (
    <body>
      <DocsShell current={current} navigation={pages} locale={locale} headings={page.headings}>
        {children}
      </DocsShell>
    </body>
  );
};

export const renderDocsLayout = (pathname: string, children: ReactNode): JSX.Element => {
  const locale = documentLocale(pathname);
  return (
    <html lang={locale} className="dark">
      {renderDocumentHead()}
      {renderDocumentBody(pathname, locale, children)}
    </html>
  );
};

const renderArticleHeader = ({ description, section, title }: RenderableDocPage): JSX.Element => (
  <header className="not-prose mb-10 border-b pb-8">
    <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-700">
      {section}
    </p>
    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
    <p className="mt-4 text-base leading-8 text-muted-foreground">{description}</p>
  </header>
);

const renderSourceVersion = (locale: DocLocale): JSX.Element => (
  <p>
    {locale === "en" ? "Source version: " : "解説対象: "}
    <code>@effront/core@{architectureBaseline.version}</code>
  </p>
);

const renderBaselineCommit = (locale: DocLocale): JSX.Element => (
  <p>
    {locale === "en" ? "Baseline commit: " : "基準コミット: "}
    <code className="break-all">{architectureBaseline.commit}</code>
  </p>
);

const renderArchitectureBaseline = (locale: DocLocale): JSX.Element => (
  <aside
    className="not-prose mb-8 rounded-lg border p-4 text-sm leading-7 text-muted-foreground"
    data-architecture-baseline={architectureBaseline.commit}
  >
    {renderSourceVersion(locale)}
    {renderBaselineCommit(locale)}
    <p>
      {locale === "en"
        ? `Reviewed on ${architectureBaseline.reviewedOn}. This chapter explains the implementation at this baseline.`
        : `確認日: ${architectureBaseline.reviewedOn}。この版の実装を基準に解説しています。`}
    </p>
  </aside>
);

const renderArticle = (page: RenderableDocPage, content: ReactNode): JSX.Element => (
  <article className="prose prose-neutral max-w-none dark:prose-invert" data-doc-page={page.slug}>
    {renderArticleHeader(page)}
    {(page.section === "アーキテクチャ" || page.section === "Architecture") &&
      renderArchitectureBaseline(documentLocale(page.slug))}
    {content}
  </article>
);

export const renderDocsPage = (page: RenderableDocPage, content: ReactNode): JSX.Element => (
  <>
    <title>{`${page.title} | Effront`}</title>
    <meta name="description" content={page.description} />
    {renderArticle(page, content)}
  </>
);
