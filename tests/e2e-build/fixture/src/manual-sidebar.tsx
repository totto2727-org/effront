import type { ChangeEvent, JSX } from "react";
import { pages } from "./manual-pages.ts";

type SidebarProps = Readonly<{
  close: () => void;
  pathname: string;
  query: string;
  update: (event: ChangeEvent<HTMLInputElement>) => void;
}>;

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function ManualSidebar({ close, pathname, query, update }: SidebarProps): JSX.Element {
  const filter = query.trim().toLowerCase();
  const links = pages.filter((page) => page.title.toLowerCase().includes(filter));

  return (
    <>
      <label>
        ガイドを絞り込む
        <input onChange={update} value={query} />
      </label>
      <div data-sidebar="content">
        {links.map((page) => (
          <a
            aria-current={page.href === pathname ? "page" : undefined}
            data-sidebar="menu-button"
            href={page.href}
            key={page.href}
            onClick={close}
          >
            {page.title}
          </a>
        ))}
      </div>
    </>
  );
}
