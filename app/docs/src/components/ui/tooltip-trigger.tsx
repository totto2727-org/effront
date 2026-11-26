import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ComponentProps, JSX } from "react";

export const TooltipTrigger = (
  props: ComponentProps<typeof TooltipPrimitive.Trigger>,
): JSX.Element => (
  // oxlint-disable-next-line react/jsx-props-no-spreading -- Radix requires native trigger events and the slotted ref.
  <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
);
