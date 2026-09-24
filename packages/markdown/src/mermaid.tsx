"use client";

import { type ComponentProps, useEffect, useState } from "react";

type MermaidComponent = typeof import("@comark/react/components/Mermaid").Mermaid;
type MermaidProps = ComponentProps<MermaidComponent>;

interface MarkdownMermaidProps extends MermaidProps {
  readonly "theme-dark"?: MermaidProps["themeDark"];
}

/** Lazily loads Comark's Mermaid component without including it in the SSR graph. */
export function MarkdownMermaid({
  className = "",
  "theme-dark": themeDarkAttribute,
  themeDark,
  ...props
}: MarkdownMermaidProps) {
  const [Mermaid, setMermaid] = useState<MermaidComponent>();

  useEffect(() => {
    if (import.meta.env.SSR) return;
    let cancelled = false;
    void import("@comark/react/components/Mermaid").then(({ Mermaid }) => {
      if (!cancelled) setMermaid(() => Mermaid);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Mermaid) return <div className={`mermaid ${className}`} />;
  const resolvedThemeDark = themeDark ?? themeDarkAttribute;
  const mermaidProps =
    resolvedThemeDark === undefined ? props : { ...props, themeDark: resolvedThemeDark };
  return <Mermaid className={className} {...mermaidProps} />;
}
