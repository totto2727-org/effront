import { Array, Option, Predicate, String } from "effect";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import type { JSX, ReactNode } from "react";

import type { DocLocale } from "#docs/content/locale.ts";
import type {
  DocsNavigationProps,
  DocsShellProps,
  Heading,
  NavigationItem,
} from "./docs-shell-types.ts";

type ArticleProps = Omit<DocsShellProps, "locale"> & Readonly<{ locale: DocLocale }>;

const adjacentOffset = 1;

const previousLabel = (locale: DocLocale): JSX.Element => (
  <span className="flex items-center gap-1 text-xs text-muted-foreground">
    {/* oxlint-disable-next-line react/forbid-component-props -- Match the arrow size to the preceding page label. */}
    <ArrowLeftIcon className="size-3" /> {locale === "en" ? "Previous page" : "前のページ"}
  </span>
);

const nextLabel = (locale: DocLocale): JSX.Element => (
  <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
    {locale === "en" ? "Next page" : "次のページ"}{" "}
    {/* oxlint-disable-next-line react/forbid-component-props -- Match the arrow size to the next page label. */}
    <ArrowRightIcon className="size-3" />
  </span>
);

const renderPrevious = (page: NavigationItem | undefined, locale: DocLocale): JSX.Element =>
  Predicate.isNullish(page) ? (
    <span />
  ) : (
    <a
      href={page.slug}
      className="group rounded-lg border border-border p-4 outline-none hover:border-foreground/25 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
    >
      {previousLabel(locale)}
      <span className="mt-1 block font-medium group-hover:text-emerald-700">{page.title}</span>
    </a>
  );

const renderNext = (page: NavigationItem, locale: DocLocale): JSX.Element => (
  <a
    href={page.slug}
    className="group rounded-lg border border-border p-4 text-right outline-none hover:border-foreground/25 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
  >
    {nextLabel(locale)}
    <span className="mt-1 block font-medium group-hover:text-emerald-700">{page.title}</span>
  </a>
);

const renderAdjacentLinks = ({
  current,
  navigation,
  locale,
}: DocsNavigationProps): JSX.Element | undefined => {
  const position = Array.findFirstIndex(navigation, (item) => item.slug === current.slug);
  if (Option.isNone(position)) {
    return undefined;
  }
  const previous = navigation[position.value - adjacentOffset];
  const next = navigation[position.value + adjacentOffset];
  if (Predicate.isNullish(previous) && Predicate.isNullish(next)) {
    return undefined;
  }
  return (
    <nav
      aria-label={locale === "en" ? "Previous and next pages" : "前後のページ"}
      className="mt-16 grid gap-3 border-t border-border pt-7 sm:grid-cols-2"
    >
      {renderPrevious(previous, locale)}
      {Predicate.isNotNullish(next) && renderNext(next, locale)}
    </nav>
  );
};

const renderFallbackLink = (
  { group, section, slug, title }: NavigationItem,
  current: NavigationItem,
): JSX.Element => (
  <li key={slug}>
    <a href={slug} aria-current={slug === current.slug ? "page" : undefined}>
      {section}: {Predicate.isNotNullish(group) && String.isNonEmpty(group) ? `${group}: ` : ""}
      {title}
    </a>
  </li>
);

const renderFallbackTitle = (): JSX.Element => (
  <p>
    <strong>Effront</strong> Effect-powered frontends. Fetch-native.
  </p>
);

const renderFallbackNavigation = ({
  current,
  navigation,
  locale,
}: DocsNavigationProps): JSX.Element => (
  <nav
    aria-label={locale === "en" ? "Documentation navigation" : "ドキュメントナビゲーション"}
    className="docs-noscript-nav"
  >
    {renderFallbackTitle()}
    <ul>{navigation.map((item) => renderFallbackLink(item, current))}</ul>
  </nav>
);

const renderArticleMain = (navigation: DocsNavigationProps, children: ReactNode): JSX.Element => (
  <main id="main-content" className="min-w-0 px-5 py-10 sm:px-8 sm:py-14 lg:px-14">
    <noscript>{renderFallbackNavigation(navigation)}</noscript>
    <div className="max-w-3xl">{children}</div>
    {renderAdjacentLinks(navigation)}
  </main>
);

const renderHeadingLink = ({ id, title }: Heading): JSX.Element => (
  <li key={id}>
    <a
      className="block -ml-px border-l border-transparent [overflow-wrap:anywhere] py-0.5 pl-3 text-muted-foreground outline-none hover:border-emerald-600 hover:text-foreground focus-visible:border-emerald-600 focus-visible:text-foreground"
      href={`#${id}`}
    >
      {title}
    </a>
  </li>
);

const renderHeadings = (headings: Readonly<Heading[]>, label: string): JSX.Element => (
  <nav className="sticky top-23">
    <p className="mb-3 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
      {label}
    </p>
    <ol className="space-y-2 border-l border-border text-sm">
      {headings.map((heading) => renderHeadingLink(heading))}
    </ol>
  </nav>
);

const renderContents = (headings: Readonly<Heading[]>, locale: DocLocale): JSX.Element => {
  const label = locale === "en" ? "On this page" : "このページ内";
  return (
    <aside aria-label={label} className="hidden border-l border-border/70 px-6 py-14 lg:block">
      {Array.isReadonlyArrayNonEmpty(headings) && renderHeadings(headings, label)}
    </aside>
  );
};

export const renderDocsArticle = ({
  children,
  current,
  headings,
  locale,
  navigation,
}: ArticleProps): JSX.Element => (
  <div className="mx-auto grid w-full max-w-[90rem] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_11rem]">
    {renderArticleMain({ current, locale, navigation }, children)}
    {renderContents(headings, locale)}
  </div>
);
