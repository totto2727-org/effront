"use client";

import { useCallback, useState } from "react";
import type { JSX, ReactNode } from "react";

const initialCount = 0;
const increment = 1;

export const Shell = ({ children }: Readonly<{ children: ReactNode }>): JSX.Element => {
  const [count, setCount] = useState(initialCount);
  const incrementCount = useCallback(() => {
    setCount((value) => value + increment);
  }, []);
  return (
    <>
      <header className="flex flex-wrap items-center gap-8 border-b border-slate-700 px-8 py-4">
        <a className="text-blue-300 underline" href="/manual">
          Markdown manual
        </a>
        <button
          className="rounded border border-slate-600 bg-slate-800 px-4 py-2"
          type="button"
          onClick={incrementCount}
        >
          Count: {count}
        </button>
      </header>
      <main className="mx-auto max-w-[54rem] p-8 leading-[1.8]">{children}</main>
    </>
  );
};
