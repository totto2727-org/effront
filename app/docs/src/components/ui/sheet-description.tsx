import { Dialog as SheetPrimitive } from "radix-ui";
import type { ComponentProps, JSX } from "react";

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function SheetDescription(
  props: ComponentProps<typeof SheetPrimitive.Description>,
): JSX.Element {
  return (
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward the description's native attributes and ref for Radix accessibility.
    <SheetPrimitive.Description data-slot="sheet-description" {...props} />
  );
}
