import { Dialog as SheetPrimitive } from "radix-ui";
import type { ComponentProps, JSX } from "react";

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function SheetTitle(props: ComponentProps<typeof SheetPrimitive.Title>): JSX.Element {
  return (
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward the title's native attributes and ref for Radix accessibility.
    <SheetPrimitive.Title data-slot="sheet-title" {...props} />
  );
}
