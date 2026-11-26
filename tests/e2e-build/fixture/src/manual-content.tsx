import { Predicate } from "effect";
import type { JSX, ReactNode } from "react";
import { pages } from "./manual-pages.ts";

const adjacentPage = 1;

const sectionLink = (pathname: string): string => {
  if (pathname === "/manual") {
    return "#features";
  }
  return pathname.endsWith("getting-started") ? "#installation" : "#details";
};

export const ManualContent = ({
  children,
  pathname,
}: Readonly<{ children: ReactNode; pathname: string }>): JSX.Element => {
  const current = pages.findIndex((page) => page.href === pathname);
  const previous = pages[current - adjacentPage];
  const next = pages[current + adjacentPage];
  const breadcrumb = (
    <nav aria-label="パンくずリスト">
      <a href="/manual">Manual</a>
      <span aria-current="page">{pages[current]?.title}</span>
    </nav>
  );
  const pageLinks = (
    <nav aria-label="前後のページ">
      {Predicate.isNotNullish(previous) && <a href={previous.href}>前のページ</a>}
      {Predicate.isNotNullish(next) && <a href={next.href}>次のページ</a>}
    </nav>
  );
  const section = (
    <aside aria-label="このページ内">
      <a href={sectionLink(pathname)}>Section</a>
    </aside>
  );

  return (
    <div className="manual-body">
      {breadcrumb}
      {children}
      {pageLinks}
      {section}
    </div>
  );
};
