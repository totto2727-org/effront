"use client";

import type { JSX, PropsWithChildren } from "react";

// Confirms the public document renderer preserves consumer component overrides.
export const MarkdownHeading = ({
  children,
  ...props
}: PropsWithChildren<Record<string, unknown>>): JSX.Element => (
  // oxlint-disable-next-line react/jsx-props-no-spreading -- The public override forwards all authored heading attributes alongside the marker.
  <h1 {...props} data-testid="markdown-heading-override">
    {children}
  </h1>
);
