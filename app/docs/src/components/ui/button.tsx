"use client";

import * as React from "react";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "#docs/lib/utils.ts";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    defaultVariants: { size: "default", variant: "default" },
    // oxlint-disable-next-line eslint/sort-keys -- CVA emits these classes in declaration order, which preserves their SSR output.
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: { default: "h-9 px-4 py-2", icon: "size-9" },
    },
  },
);

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }): React.JSX.Element {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      // oxlint-disable-next-line react/forbid-component-props -- Both the native button and its Radix slot need the variant styles.
      className={cn(buttonVariants({ size, variant }), className)}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward native events, ARIA attributes, and refs through the slot and button.
      {...props}
    />
  );
}
