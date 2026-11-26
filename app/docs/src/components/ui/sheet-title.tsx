import { Dialog as SheetPrimitive } from "radix-ui";
import type { ComponentProps, JSX } from "react";

export const SheetTitle = (props: ComponentProps<typeof SheetPrimitive.Title>): JSX.Element => (
  // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward the title's native attributes and ref for Radix accessibility.
  <SheetPrimitive.Title data-slot="sheet-title" {...props} />
);
