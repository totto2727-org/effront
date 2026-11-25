"use client";

import type { JSX, ReactNode } from "react";

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function Shell({ children }: Readonly<{ children: ReactNode }>): JSX.Element {
  return (
    <>
      <nav className="flex flex-wrap gap-4">
        <a className="text-blue-700 underline" href="/">
          Home
        </a>{" "}
        <a className="text-blue-700 underline" href="/about">
          About
        </a>
      </nav>
      <main className="max-w-3xl">{children}</main>
    </>
  );
}
