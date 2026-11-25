"use client";

import type { ChangeEvent, JSX, ReactNode, RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Counter } from "./counter.tsx";
import { ManualContent } from "./manual-content.tsx";
import { ManualSidebar } from "./manual-sidebar.tsx";

type ManualNavigation = Readonly<{
  close: () => void;
  dialog: RefObject<HTMLDialogElement | null>;
  query: string;
  restoreFocus: () => void;
  show: () => void;
  toggle: RefObject<HTMLButtonElement | null>;
  update: (event: ChangeEvent<HTMLInputElement>) => void;
}>;

const useManualNavigation = (children: ReactNode): ManualNavigation => {
  const [query, setQuery] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const rendered = useRef(children);
  const close = useCallback(() => {
    dialog.current?.close();
  }, []);
  const show = useCallback(() => {
    dialog.current?.showModal();
  }, []);
  const restoreFocus = useCallback(() => {
    toggle.current?.focus();
  }, []);
  const update = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  }, []);

  useEffect(() => {
    if (rendered.current !== children) {
      rendered.current = children;
      close();
    }
  }, [children, close]);

  return { close, dialog, query, restoreFocus, show, toggle, update };
};

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function ManualShell({
  children,
  pathname,
}: Readonly<{
  children: ReactNode;
  pathname: string;
}>): JSX.Element {
  const { close, dialog, query, restoreFocus, show, toggle, update } =
    useManualNavigation(children);
  const button = (
    <button className="mobile-toggle" onClick={show} ref={toggle} type="button">
      Toggle Sidebar
    </button>
  );
  const navigation = (
    <ManualSidebar close={close} pathname={pathname} query={query} update={update} />
  );
  const toolbar = (
    <header className="manual-toolbar">
      <Counter />
      {button}
    </header>
  );
  const desktop = (
    <aside aria-label="Manual sidebar" data-sidebar="sidebar">
      {navigation}
    </aside>
  );
  const mobile = (
    <dialog aria-label="Manual navigation" onClose={restoreFocus} ref={dialog}>
      {navigation}
    </dialog>
  );

  return (
    <section className="manual-layout">
      {toolbar}
      {desktop}
      {mobile}
      <ManualContent pathname={pathname}>{children}</ManualContent>
    </section>
  );
}
