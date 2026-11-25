"use client";

import type { JSX, PropsWithChildren } from "react";

// Confirms the public document renderer preserves consumer component overrides.
// oxlint-disable-next-line eslint/func-style -- React’s component definition rule requires a named declaration.
export function MarkdownHeading({
  children,
  ...props
}: PropsWithChildren<Record<string, unknown>>): JSX.Element {
  return (
    // oxlint-disable-next-line react/jsx-props-no-spreading -- The public override forwards all authored heading attributes alongside the marker.
    <h1 {...props} data-testid="markdown-heading-override">
      {children}
    </h1>
  );
}
