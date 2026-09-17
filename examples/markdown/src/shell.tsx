"use client";

import { useState, type ReactNode } from "react";
import "./styles.css";

export function Shell({ children }: { readonly children: ReactNode }) {
  const [count, setCount] = useState(0);
  return (
    <>
      <header className="flex flex-wrap items-center gap-8 border-b border-slate-700 px-8 py-4">
        <a className="text-blue-300 underline" href="/manual">
          Markdown manual
        </a>
        <button
          className="rounded border border-slate-600 bg-slate-800 px-4 py-2"
          type="button"
          onClick={() => setCount((value) => value + 1)}
        >
          Count: {count}
        </button>
      </header>
      <main className="mx-auto max-w-[54rem] p-8 leading-[1.8]">{children}</main>
    </>
  );
}
