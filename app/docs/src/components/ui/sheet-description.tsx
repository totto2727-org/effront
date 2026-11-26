import { Dialog as SheetPrimitive } from "radix-ui";
import type { ComponentProps, JSX } from "react";

export const SheetDescription = (
  props: ComponentProps<typeof SheetPrimitive.Description>,
): JSX.Element => (
  // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward the description's native attributes and ref for Radix accessibility.
  <SheetPrimitive.Description data-slot="sheet-description" {...props} />
);
