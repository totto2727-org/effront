import type { ComponentProps, JSX } from "react";

import { cn } from "#docs/lib/utils.ts";
import { Separator } from "./separator.tsx";

export const SidebarSeparator = ({
  className,
  ...props
}: ComponentProps<typeof Separator>): JSX.Element => (
  <Separator
    data-sidebar="separator"
    // oxlint-disable-next-line react/forbid-component-props -- The separator spans the sidebar content with its own margins.
    className={cn("mx-3 w-auto bg-sidebar-border", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Preserve Radix separator orientation, attributes, and ref.
    {...props}
  />
);
