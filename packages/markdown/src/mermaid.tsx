"use client";

import { useEffect, useState } from "react";

type MermaidComponent = typeof import("@comark/react/components/Mermaid").Mermaid;

interface MarkdownMermaidProps {
  readonly className?: string;
  readonly content: string;
  readonly height?: string;
  readonly theme?: string;
  readonly "theme-dark"?: string;
  readonly themeDark?: string;
  readonly width?: string;
}

/** Lazily loads Comark's Mermaid component without including it in the SSR graph. */
export function MarkdownMermaid({ className = "", ...props }: MarkdownMermaidProps) {
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
  return <Mermaid className={className} {...props} />;
}
