"use client";

import type { JSX, ReactNode } from "react";
// oxlint-disable-next-line import/no-unassigned-import -- Vite includes this stylesheet in the fixture's root client layout.
import "./styles.css";

export const ExampleShell = ({ children }: Readonly<{ children: ReactNode }>): JSX.Element => (
  <>
    <nav>
      <a href="/">Home</a> <a href="/about">About</a>
      <a href="/transitions/default-a">Page transitions</a>
    </nav>
    <main>{children}</main>
  </>
);
