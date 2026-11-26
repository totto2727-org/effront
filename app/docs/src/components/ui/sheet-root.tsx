import { Dialog as SheetPrimitive } from "radix-ui";
import type { ComponentProps, JSX } from "react";

export const Sheet = (props: ComponentProps<typeof SheetPrimitive.Root>): JSX.Element => (
  // oxlint-disable-next-line react/jsx-props-no-spreading -- Pass through Radix dialog state, event callbacks, and children.
  <SheetPrimitive.Root data-slot="sheet" {...props} />
);
