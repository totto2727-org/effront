import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ComponentProps, JSX } from "react";

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function TooltipTrigger(
  props: ComponentProps<typeof TooltipPrimitive.Trigger>,
): JSX.Element {
  return (
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Radix requires native trigger events and the slotted ref.
    <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
  );
}
