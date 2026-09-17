"use client";

import { useState, type ReactNode } from "react";
import { Counter } from "./counter";
import "./styles.css";

export function PageNote() {
  const [note, setNote] = useState("");
  return (
    <p className="my-4">
      <label>
        Page note{" "}
        <input
          className="rounded border border-slate-400 bg-white px-2 py-1"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
    </p>
  );
}

export function ExampleShell({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <nav className="flex flex-wrap gap-4">
        <a className="text-blue-700 underline" href="/">
          Home
        </a>{" "}
        <a className="text-blue-700 underline" href="/about">
          About
        </a>
        <a className="text-blue-700 underline" href="/transitions/default-a">
          Page transitions
        </a>
      </nav>
      <main className="max-w-3xl">{children}</main>
    </>
  );
}

export function TransitionExampleLayout({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <aside aria-label="Persistent transition layout">
        <h2 className="my-5 text-2xl font-bold">Page transitions</h2>
        <p className="my-4">
          This counter belongs to the layout and stays mounted while the page changes.
        </p>
        <Counter />
        <nav className="flex flex-wrap gap-4" aria-label="Transition examples">
          <a className="text-blue-700 underline" href="/transitions/default-a">
            Default transition
          </a>
          <a className="text-blue-700 underline" href="/transitions/custom-a">
            Custom transition
          </a>
          <a className="text-blue-700 underline" href="/transitions/typed-a">
            Link-selected transition
          </a>
          <a className="text-blue-700 underline" href="/transitions/disabled-a">
            Disabled transition
          </a>
        </nav>
      </aside>
      {children}
    </>
  );
}
