import type { ComponentProps, JSX } from "react";

export const SidebarMenuItem = (props: ComponentProps<"li">): JSX.Element => (
  // oxlint-disable-next-line react/jsx-props-no-spreading -- Preserve native list-item properties and forwarded refs.
  <li data-sidebar="menu-item" data-slot="sidebar-menu-item" {...props} />
);
