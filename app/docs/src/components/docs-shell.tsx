"use client";

import type { ReactNode } from "react";

import { renderDocsArticle } from "./docs-shell-article.tsx";
import { renderDocsHeader } from "./docs-shell-header.tsx";
import { DocsNavigation } from "./docs-shell-navigation.tsx";
import type { DocsShellProps } from "./docs-shell-types.ts";
import { Sidebar, SidebarInset, SidebarProvider } from "./ui/sidebar.tsx";

export type { DocsShellProps } from "./docs-shell-types.ts";

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function DocsShell({
  children,
  current,
  headings,
  locale = "ja",
  navigation,
}: DocsShellProps): ReactNode {
  return (
    <SidebarProvider defaultOpen>
      <a href="#main-content" className="skip-link">
        {locale === "en" ? "Skip to content" : "本文へ移動"}
      </a>
      <Sidebar>
        <DocsNavigation current={current} navigation={navigation} locale={locale} />
      </Sidebar>
      <SidebarInset>
        {renderDocsHeader(current, locale)}
        {renderDocsArticle({ children, current, headings, locale, navigation })}
      </SidebarInset>
    </SidebarProvider>
  );
}
