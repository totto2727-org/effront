import type { ComponentProps, JSX } from "react";

import { cn } from "#docs/lib/utils.ts";
import { Separator } from "./separator.tsx";

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function SidebarSeparator({
  className,
  ...props
}: ComponentProps<typeof Separator>): JSX.Element {
  return (
    <Separator
      data-sidebar="separator"
      // oxlint-disable-next-line react/forbid-component-props -- The separator spans the sidebar content with its own margins.
      className={cn("mx-3 w-auto bg-sidebar-border", className)}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Preserve Radix separator orientation, attributes, and ref.
      {...props}
    />
  );
}
