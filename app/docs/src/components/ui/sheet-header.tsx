import type { ComponentProps, JSX } from "react";

export const SheetHeader = (props: ComponentProps<"div">): JSX.Element => (
  // oxlint-disable-next-line react/jsx-props-no-spreading -- Preserve the heading wrapper's native styling and accessibility props.
  <div data-slot="sheet-header" {...props} />
);
