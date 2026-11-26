import type { ComponentProps, JSX } from "react";

import { cn } from "#docs/lib/utils.ts";

export const Skeleton = ({ className, ...props }: ComponentProps<"div">): JSX.Element => (
  <div
    data-slot="skeleton"
    className={cn("animate-pulse rounded-md bg-accent", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Preserve native div attributes and refs.
    {...props}
  />
);
