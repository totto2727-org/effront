import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ComponentProps, JSX } from "react";

export const Tooltip = (props: ComponentProps<typeof TooltipPrimitive.Root>): JSX.Element => (
  // oxlint-disable-next-line react/jsx-props-no-spreading -- Preserve Radix tooltip timing, state, and callbacks.
  <TooltipPrimitive.Root data-slot="tooltip" {...props} />
);
