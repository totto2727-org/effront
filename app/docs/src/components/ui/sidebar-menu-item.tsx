import type { ComponentProps, JSX } from "react";

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function SidebarMenuItem(props: ComponentProps<"li">): JSX.Element {
  return (
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Preserve native list-item properties and forwarded refs.
    <li data-sidebar="menu-item" data-slot="sidebar-menu-item" {...props} />
  );
}
