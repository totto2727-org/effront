import type { ReactNode } from "react";
import type { DocLocale } from "#docs/content/locale.ts";

export type NavigationItem = Readonly<{
  group?: string;
  section: string;
  slug: string;
  title: string;
}>;
export type Heading = Readonly<{ id: string; title: string }>;

export type DocsShellProps = Readonly<{
  children: ReactNode;
  current: NavigationItem;
  headings: Readonly<Heading[]>;
  locale?: DocLocale;
  navigation: Readonly<NavigationItem[]>;
}>;

export type DocsNavigationProps = Required<
  Pick<DocsShellProps, "current" | "navigation" | "locale">
>;
