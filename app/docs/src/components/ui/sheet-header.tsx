import type { ComponentProps, JSX } from "react";

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function SheetHeader(props: ComponentProps<"div">): JSX.Element {
  return (
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Preserve the heading wrapper's native styling and accessibility props.
    <div data-slot="sheet-header" {...props} />
  );
}
