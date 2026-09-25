"use client";

import { type ComponentProps, lazy, Suspense, use } from "react";
import { browser } from "react-dom";

type MermaidComponent = typeof import("@comark/react/components/Mermaid").Mermaid;
type MermaidProps = ComponentProps<MermaidComponent>;

interface MarkdownMermaidProps extends MermaidProps {
  readonly "theme-dark"?: MermaidProps["themeDark"];
}

const Mermaid = import.meta.env.SSR
  ? () => null
  : lazy(() =>
      import("@comark/react/components/Mermaid").then(({ Mermaid }) => ({ default: Mermaid })),
    );

function BrowserMermaid(props: MermaidProps) {
  use(browser());
  return <Mermaid {...props} />;
}

/** Defers Comark's Mermaid component to the browser without loading it in an SSR graph. */
export function MarkdownMermaid({
  className = "",
  "theme-dark": themeDarkAttribute,
  themeDark,
  ...props
}: MarkdownMermaidProps) {
  const resolvedThemeDark = themeDark ?? themeDarkAttribute;
  const mermaidProps =
    resolvedThemeDark === undefined
      ? { ...props, className }
      : { ...props, className, themeDark: resolvedThemeDark };
  return (
    <Suspense fallback={<div className={`mermaid ${className}`} />}>
      <BrowserMermaid {...mermaidProps} />
    </Suspense>
  );
}
