"use client";

import type { ReactNode } from "react";

export function Shell({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <nav className="flex flex-wrap gap-4">
        <a className="text-blue-700 underline" href="/">
          Home
        </a>{" "}
        <a className="text-blue-700 underline" href="/about">
          About
        </a>
        <a className="text-blue-700 underline" href="/loading">
          Loading / Suspense
        </a>
      </nav>
      <main className="max-w-3xl">{children}</main>
    </>
  );
}
