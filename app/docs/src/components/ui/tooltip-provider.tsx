import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ComponentProps, JSX } from "react";

export const TooltipProvider = ({
  delayDuration = 0,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Provider>): JSX.Element => (
  <TooltipPrimitive.Provider
    data-slot="tooltip-provider"
    delayDuration={delayDuration}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Preserve Radix configuration for skip timing and hoverable content.
    {...props}
  />
);
