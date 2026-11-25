import { Dialog as SheetPrimitive } from "radix-ui";
import type { ComponentProps, JSX } from "react";

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function Sheet(props: ComponentProps<typeof SheetPrimitive.Root>): JSX.Element {
  return (
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Pass through Radix dialog state, event callbacks, and children.
    <SheetPrimitive.Root data-slot="sheet" {...props} />
  );
}
