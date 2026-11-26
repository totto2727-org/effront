import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ComponentProps, JSX } from "react";

import { cn } from "#docs/lib/utils.ts";

export const TooltipContent = ({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>): JSX.Element => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      data-slot="tooltip-content"
      sideOffset={sideOffset}
      // oxlint-disable-next-line react/forbid-component-props -- The portaled tooltip needs its design system styles and state animations.
      className={cn(
        "z-50 rounded-md bg-foreground px-2.5 py-1.5 text-xs text-background shadow-md data-[state=closed]:animate-out data-[state=open]:animate-in",
        className,
      )}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Preserve the native attributes, position, event, and ref contract.
      {...props}
    />
  </TooltipPrimitive.Portal>
);
