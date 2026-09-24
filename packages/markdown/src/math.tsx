"use client";

import katex from "katex";
import { useEffect, useState } from "react";

interface MarkdownMathProps {
  readonly className?: string;
  readonly content: string;
}

/** Mirrors Comark's client-only Math behavior while keeping the document renderer server-safe. */
export function MarkdownMath({ content, className = "" }: MarkdownMathProps) {
  const isInline = className.includes("inline");
  const [html, setHtml] = useState("...");

  // oxlint-disable react(set-state-in-effect)
  useEffect(() => {
    try {
      setHtml(katex.renderToString(content, { displayMode: !isInline, throwOnError: true }));
    } catch {
      setHtml("...");
    }
  }, [content, isInline]);

  const Element = isInline ? "span" : "div";
  return (
    <Element
      className={`math ${isInline ? "inline" : "block"}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
