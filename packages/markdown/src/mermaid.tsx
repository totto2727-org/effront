"use client";

import { type ComponentProps, lazy, Suspense, use } from "react";
import { browser } from "react-dom";

type MermaidComponent = typeof import("@comark/react/components/Mermaid").Mermaid;
type MermaidProps = ComponentProps<MermaidComponent>;

const ComarkMermaid = import.meta.env.SSR
  ? () => null
  : lazy(() =>
      import("@comark/react/components/Mermaid").then(({ Mermaid }) => ({ default: Mermaid })),
    );

function BrowserMermaid(props: MermaidProps) {
  use(browser());
  return <ComarkMermaid {...props} />;
}

/** Defers Comark's Mermaid component to the browser without loading it in an SSR graph. */
export function Mermaid(props: MermaidProps) {
  return (
    <Suspense fallback={<div className="mermaid" />}>
      <BrowserMermaid {...props} />
    </Suspense>
  );
}
