import type { ComponentProps, JSX } from "react";

import { cn } from "#docs/lib/utils.ts";

export const SidebarMenu = ({ className, ...props }: ComponentProps<"ul">): JSX.Element => (
  <ul
    data-sidebar="menu"
    data-slot="sidebar-menu"
    className={cn("flex min-w-0 flex-col gap-0.5", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Consumers supply native list attributes, including the accessible group label.
    {...props}
  />
);
