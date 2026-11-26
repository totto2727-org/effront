"use client";

import type { MermaidProps } from "@comark/react/components/Mermaid";
import { createElement, lazy, Suspense, use } from "react";
import type { ReactElement, ReactNode } from "react";
import { browser } from "react-dom";

const ComarkMermaid = import.meta.env.SSR
  ? (): ReactNode => undefined
  : lazy(async () => {
      const { Mermaid: Diagram } = await import("@comark/react/components/Mermaid");
      return { default: Diagram };
    });

const BrowserMermaid = (props: MermaidProps): ReactElement => {
  use(browser());
  return createElement(ComarkMermaid, props);
};

const placeholder = <div className="mermaid" />;

/**
 * Defers Comark's Mermaid component until the browser is ready.
 * @param {MermaidProps} props The original Comark Mermaid props.
 * @returns {ReactElement} A diagram with a server-rendered loading placeholder.
 */
// oxlint-disable-next-line react/no-multi-comp -- Keep the browser-only component with the browser gate that renders beneath its Suspense boundary.
export const Mermaid = (props: MermaidProps): ReactElement => {
  const diagram = createElement(BrowserMermaid, props);
  return <Suspense fallback={placeholder}>{diagram}</Suspense>;
};
