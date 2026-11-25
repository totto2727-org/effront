import type { ComponentProps, JSX } from "react";

import { cn } from "#docs/lib/utils.ts";

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function Skeleton({ className, ...props }: ComponentProps<"div">): JSX.Element {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-accent", className)}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Preserve native div attributes and refs.
      {...props}
    />
  );
}
