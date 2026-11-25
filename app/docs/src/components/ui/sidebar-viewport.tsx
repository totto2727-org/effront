import type { ComponentProps, JSX } from "react";

import { cn } from "#docs/lib/utils.ts";
import { SidebarMobile } from "./sidebar-mobile.tsx";
import { useSidebar } from "./sidebar-context.ts";
import type { SidebarContextProps } from "./sidebar-context.ts";

type SidebarSide = "left" | "right";
type SidebarCollapse = "offcanvas" | "icon" | "none";
type SidebarProps = ComponentProps<"div"> & {
  collapsible?: SidebarCollapse;
  side?: SidebarSide;
};

const renderFixedSidebar = ({
  children,
  className,
  ...props
}: ComponentProps<"div">): JSX.Element => (
  <div
    data-slot="sidebar"
    className={cn(
      "flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground",
      className,
    )}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- The fixed Sidebar forwards its native div attributes and ref.
    {...props}
  >
    {children}
  </div>
);

const renderDesktopContainer = (
  { children, className, ...props }: ComponentProps<"div">,
  side: SidebarSide,
): JSX.Element => (
  <div
    data-slot="sidebar-container"
    className={cn(
      "fixed inset-y-0 z-30 hidden h-svh w-(--sidebar-width) border-r border-sidebar-border transition-[left,width] duration-200 ease-linear md:flex",
      side === "left"
        ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
        : "right-0",
      className,
    )}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- The desktop Sidebar forwards native attributes and its ref to the fixed container.
    {...props}
  >
    <div
      data-sidebar="sidebar"
      data-slot="sidebar-inner"
      className="flex h-full w-full flex-col bg-sidebar"
    >
      {children}
    </div>
  </div>
);

const renderDesktopSidebar = (
  props: ComponentProps<"div">,
  {
    side,
    state,
    collapsible,
  }: Readonly<{
    collapsible: SidebarCollapse;
    side: SidebarSide;
    state: SidebarContextProps["state"];
  }>,
): JSX.Element => (
  <div
    className="group peer hidden text-sidebar-foreground md:block"
    data-state={state}
    data-collapsible={state === "collapsed" ? collapsible : ""}
    data-side={side}
    data-slot="sidebar"
  >
    <div
      data-slot="sidebar-gap"
      className="relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear group-data-[collapsible=offcanvas]:w-0"
    />
    {renderDesktopContainer(props, side)}
  </div>
);

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function Sidebar({
  collapsible = "offcanvas",
  side = "left",
  ...props
}: SidebarProps): JSX.Element {
  const { isMobile, state } = useSidebar();
  if (collapsible === "none") {
    return renderFixedSidebar(props);
  }
  if (isMobile) {
    return <SidebarMobile side={side}>{props.children}</SidebarMobile>;
  }
  return renderDesktopSidebar(props, { collapsible, side, state });
}
