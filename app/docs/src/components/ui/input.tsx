"use client";

import * as React from "react";
import { cn } from "#docs/lib/utils.ts";

export const Input = ({
  className,
  type,
  ...props
}: React.ComponentProps<"input">): React.JSX.Element => (
  <input
    type={type}
    data-slot="input"
    className={cn(
      "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Input forwards native form events, attributes, and refs.
    {...props}
  />
);
