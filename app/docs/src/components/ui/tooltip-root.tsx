import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ComponentProps, JSX } from "react";

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function Tooltip(props: ComponentProps<typeof TooltipPrimitive.Root>): JSX.Element {
  return (
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Preserve Radix tooltip timing, state, and callbacks.
    <TooltipPrimitive.Root data-slot="tooltip" {...props} />
  );
}
