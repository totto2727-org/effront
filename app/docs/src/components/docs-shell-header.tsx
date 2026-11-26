import { Predicate, String } from "effect";
import type { JSX } from "react";

import { localizedPath } from "#docs/content/locale.ts";
import type { DocLocale } from "#docs/content/locale.ts";
import type { NavigationItem } from "./docs-shell-types.ts";
import { SidebarTrigger } from "./ui/sidebar.tsx";

type Breadcrumb = Readonly<{
  id: "section" | "group" | "page";
  title: string;
}>;

const listBreadcrumbs = ({ group, section, title }: NavigationItem): Breadcrumb[] => {
  const crumbs: Breadcrumb[] = [{ id: "section", title: section }];
  if (Predicate.isNotNullish(group) && String.isNonEmpty(group)) {
    crumbs.push({ id: "group", title: group });
  }
  crumbs.push({ id: "page", title });
  return crumbs;
};

const renderBreadcrumbItem = ({ id, title }: Breadcrumb): JSX.Element => {
  const current = id === "page";
  return (
    <li key={id} className="flex min-w-0 items-baseline gap-1.5">
      <span aria-hidden="true">/</span>
      <span
        aria-current={current ? "page" : undefined}
        className={
          current
            ? "min-w-0 text-sm font-medium wrap-break-word text-foreground"
            : "min-w-0 wrap-break-word"
        }
      >
        {title}
      </span>
    </li>
  );
};

const renderHomeBreadcrumb = (locale: DocLocale): JSX.Element => (
  <li>
    <a
      href={localizedPath("/", locale)}
      className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      {locale === "en" ? "Documentation" : "ドキュメント"}
    </a>
  </li>
);

const renderBreadcrumbs = (current: NavigationItem, locale: DocLocale): JSX.Element => (
  <nav aria-label={locale === "en" ? "Breadcrumbs" : "パンくずリスト"} className="min-w-0">
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
      {renderHomeBreadcrumb(locale)}
      {listBreadcrumbs(current).map((item) => renderBreadcrumbItem(item))}
    </ol>
  </nav>
);

const renderLocaleLink = (slug: string, language: DocLocale, active: boolean): JSX.Element => (
  <a
    href={localizedPath(slug, language)}
    hrefLang={language}
    lang={language}
    aria-current={active ? "true" : undefined}
    className="rounded px-1 py-2 underline-offset-4 hover:underline aria-current:font-semibold"
  >
    {language === "en" ? "English" : "日本語"}
  </a>
);

const renderLanguageSwitcher = (slug: string, locale: DocLocale): JSX.Element => (
  <nav
    aria-label={locale === "en" ? "Language" : "言語"}
    className="ml-auto flex shrink-0 gap-2 text-xs"
  >
    {renderLocaleLink(slug, "en", locale === "en")}
    {renderLocaleLink(slug, "ja", locale === "ja")}
  </nav>
);

export const renderDocsHeader = (current: NavigationItem, locale: DocLocale): JSX.Element => (
  <header className="sticky top-0 z-20 flex min-h-15 items-center gap-3 border-b border-border/80 bg-background/90 px-4 py-2 backdrop-blur md:px-8">
    {/* oxlint-disable-next-line react/forbid-component-props -- The mobile drawer has no trigger at the desktop breakpoint. */}
    <SidebarTrigger aria-label="Toggle Sidebar" className="md:hidden" />
    {renderBreadcrumbs(current, locale)}
    {renderLanguageSwitcher(current.slug, locale)}
  </header>
);
