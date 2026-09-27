"use client";

import type { PropsWithChildren } from "react";

/** Confirms the public document renderer preserves consumer component overrides. */
export function MarkdownHeading({
  children,
  ...props
}: PropsWithChildren<Record<string, unknown>>) {
  return (
    <h1 {...props} data-testid="markdown-heading-override">
      {children}
    </h1>
  );
}
