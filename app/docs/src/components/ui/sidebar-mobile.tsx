import { useCallback } from "react";
import type { CSSProperties, JSX, ReactNode } from "react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./sheet.tsx";
import { useSidebar } from "./sidebar-context.ts";

const mobileWidth: CSSProperties & { "--sidebar-width": string } = {
  "--sidebar-width": "19rem",
};

const renderSheetHeader = (): JSX.Element => (
  // oxlint-disable-next-line react/forbid-component-props -- Radix needs an accessible dialog title and description even though they are visually hidden.
  <SheetHeader className="sr-only">
    <SheetTitle>Documentation navigation</SheetTitle>
    <SheetDescription>Browse Effront documentation.</SheetDescription>
  </SheetHeader>
);

const renderMobileContent = (children: ReactNode): JSX.Element => (
  <div className="flex h-full w-full flex-col">{children}</div>
);

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function SidebarMobile({
  children,
  side,
}: Readonly<{ children: ReactNode; side: "left" | "right" }>): JSX.Element {
  const { openMobile, setOpenMobile, triggerRef } = useSidebar();
  const focusTrigger = useCallback(
    (event: Event) => {
      event.preventDefault();
      triggerRef.current?.focus();
    },
    [triggerRef],
  );
  return (
    <Sheet open={openMobile} onOpenChange={setOpenMobile}>
      <SheetContent
        data-sidebar="sidebar"
        data-mobile="true"
        side={side}
        onCloseAutoFocus={focusTrigger}
        // oxlint-disable-next-line react/forbid-component-props -- Keep the sheet width and visual treatment in the native sidebar CSS.
        className="w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground"
        // oxlint-disable-next-line react/forbid-component-props -- The mobile panel uses its own CSS variable for width.
        style={mobileWidth}
      >
        {renderSheetHeader()}
        {renderMobileContent(children)}
      </SheetContent>
    </Sheet>
  );
}
