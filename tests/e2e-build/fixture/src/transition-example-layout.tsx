"use client";

import type { JSX, ReactNode } from "react";
import { Counter } from "./counter.tsx";

const navigation = (
  <nav aria-label="Transition examples">
    <a href="/transitions/default-a">Default transition</a>
    <a href="/transitions/custom-a">Custom transition</a>
    <a href="/transitions/typed-a">Link-selected transition</a>
    <a href="/transitions/disabled-a">Disabled transition</a>
  </nav>
);

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function TransitionExampleLayout({
  children,
}: Readonly<{ children: ReactNode }>): JSX.Element {
  return (
    <>
      <aside aria-label="Persistent transition layout">
        <h2>Page transitions</h2>
        <p>This counter belongs to the layout and stays mounted while the page changes.</p>
        <Counter />
        {navigation}
      </aside>
      {children}
    </>
  );
}
