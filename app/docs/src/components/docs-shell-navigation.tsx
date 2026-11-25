import { Array, Predicate, String } from "effect";
import { ExternalLinkIcon, SearchIcon } from "lucide-react";
import { useCallback, useState } from "react";
import type { ChangeEvent, JSX } from "react";

import { localizedPath } from "#docs/content/locale.ts";
import type { DocLocale } from "#docs/content/locale.ts";
import type { DocsNavigationProps, NavigationItem } from "./docs-shell-types.ts";
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "./ui/sidebar.tsx";

const renderBrand = (locale: DocLocale): JSX.Element => (
  <a
    href={localizedPath("/", locale)}
    className="rounded-md px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
  >
    <span className="block font-mono text-sm font-semibold tracking-tight">Effront</span>
    <span className="block pt-0.5 text-xs text-sidebar-foreground/60">
      Effect-powered frontends. Fetch-native.
    </span>
  </a>
);

const renderSearchIcon = (): JSX.Element => (
  <SearchIcon
    aria-hidden="true"
    // oxlint-disable-next-line react/forbid-component-props -- The decorative SVG must fit inside the search input.
    className="pointer-events-none absolute top-2.5 left-3 size-3.5 text-muted-foreground"
  />
);

const renderSearch = (
  locale: DocLocale,
  query: string,
  changeQuery: (event: ChangeEvent<HTMLInputElement>) => void,
): JSX.Element => (
  <label className="relative block px-1">
    <span className="sr-only">{locale === "en" ? "Filter guides" : "ガイドを絞り込む"}</span>
    {renderSearchIcon()}
    <SidebarInput
      value={query}
      onChange={changeQuery}
      placeholder={locale === "en" ? "Search guides" : "ガイドを検索"}
      // oxlint-disable-next-line react/forbid-component-props -- This input reserves space for the overlaid search icon.
      className="pl-7"
    />
  </label>
);

const link = (item: NavigationItem, active: boolean, closeMobile: () => void): JSX.Element => (
  <a href={item.slug} aria-current={active ? "page" : undefined} onClick={closeMobile}>
    {item.title}
  </a>
);

type SectionSelection = Readonly<{ activeSlug: string; closeMobile: () => void }>;

const renderItem = (
  item: NavigationItem,
  { activeSlug, closeMobile }: SectionSelection,
): JSX.Element => {
  const active = item.slug === activeSlug;
  return (
    <SidebarMenuItem key={item.slug}>
      <SidebarMenuButton asChild isActive={active}>
        {link(item, active, closeMobile)}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

const renderGroupItems = (
  group: string,
  items: Readonly<NavigationItem[]>,
  selection: SectionSelection,
): JSX.Element => (
  <SidebarMenu
    aria-label={group}
    // oxlint-disable-next-line react/forbid-component-props -- Only nested menus need group indentation and a dividing border.
    className="ml-2 border-l border-sidebar-border pl-2"
  >
    {items.filter((item) => item.group === group).map((item) => renderItem(item, selection))}
  </SidebarMenu>
);

const renderSectionMenu = (
  section: string,
  items: Readonly<NavigationItem[]>,
  selection: SectionSelection,
): JSX.Element => (
  <SidebarMenu aria-label={section}>
    {items.flatMap((item, index) => {
      const { group } = item;
      if (Predicate.isNullish(group) || String.isEmpty(group)) {
        return [renderItem(item, selection)];
      }
      if (items.findIndex((candidate) => candidate.group === group) !== index) {
        return [];
      }
      return [
        <SidebarMenuItem key={`group:${group}`}>
          <span className="block px-2 py-1.5 text-xs font-medium text-sidebar-foreground/75">
            {group}
          </span>
          {renderGroupItems(group, items, selection)}
        </SidebarMenuItem>,
      ];
    })}
  </SidebarMenu>
);

const renderSection = (
  section: string,
  filtered: Readonly<NavigationItem[]>,
  selection: SectionSelection,
): JSX.Element => (
  <SidebarGroup key={section}>
    <SidebarGroupLabel>{section}</SidebarGroupLabel>
    {renderSectionMenu(
      section,
      filtered.filter((item) => item.section === section),
      selection,
    )}
  </SidebarGroup>
);

const renderSections = (
  filtered: Readonly<NavigationItem[]>,
  selection: SectionSelection,
  locale: DocLocale,
): JSX.Element => {
  const sections = [...new Set(filtered.map((item) => item.section))];
  return (
    <SidebarContent>
      {sections.map((section) => renderSection(section, filtered, selection))}
      {Array.isReadonlyArrayEmpty(filtered) && (
        <p className="px-5 py-4 text-sm text-sidebar-foreground/60">
          {locale === "en" ? "No guides match your search." : "一致するガイドはありません。"}
        </p>
      )}
    </SidebarContent>
  );
};

const upstreamIcon = (): JSX.Element => (
  // oxlint-disable-next-line react/forbid-component-props -- Size the decorative SVG to the adjacent footer text.
  <ExternalLinkIcon aria-hidden="true" className="size-3" />
);

const renderFooter = (locale: DocLocale): JSX.Element => (
  <SidebarFooter>
    <a
      className="flex items-center gap-2 rounded-md px-2 py-2 text-xs text-sidebar-foreground/65 outline-none hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      href="https://effective-rsc.nikhilsnayak.dev/"
      target="_blank"
      rel="noreferrer"
    >
      {locale === "en" ? "effective-rsc website" : "effective-rsc 公式サイト"} {upstreamIcon()}
    </a>
  </SidebarFooter>
);

const filterNavigation = (
  navigation: Readonly<NavigationItem[]>,
  query: string,
): NavigationItem[] => {
  const searchTerm = query.toLocaleLowerCase();
  return navigation.filter((item) =>
    [item.section, item.group, item.title]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase()
      .includes(searchTerm),
  );
};

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function DocsNavigation({ current, locale, navigation }: DocsNavigationProps): JSX.Element {
  const [query, setQuery] = useState("");
  const { setOpenMobile } = useSidebar();
  const changeQuery = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  }, []);
  const closeMobile = useCallback(() => {
    setOpenMobile(false);
  }, [setOpenMobile]);
  const filtered = filterNavigation(navigation, query);

  return (
    <>
      <SidebarHeader>
        {renderBrand(locale)}
        {renderSearch(locale, query, changeQuery)}
      </SidebarHeader>
      <SidebarSeparator />
      {renderSections(filtered, { activeSlug: current.slug, closeMobile }, locale)}
      {renderFooter(locale)}
    </>
  );
}
