import { XIcon } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import type { ComponentProps, JSX } from "react";

import { cn } from "#docs/lib/utils.ts";

type SheetSide = "top" | "right" | "bottom" | "left";

const sideClasses = {
  bottom:
    "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
  left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
  right:
    "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
  top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
} satisfies Record<SheetSide, string>;

const renderOverlay = (): JSX.Element => (
  <SheetPrimitive.Overlay
    data-slot="sheet-overlay"
    // oxlint-disable-next-line react/forbid-component-props -- The native overlay supplies the dimming and open/close transition.
    className="fixed inset-0 z-50 bg-black/40 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
  />
);

const renderCloseButton = (): JSX.Element => (
  // oxlint-disable-next-line react/forbid-component-props -- Position and style the primitive's native button with focus indicators.
  <SheetPrimitive.Close className="absolute top-3 right-3 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
    {/* oxlint-disable-next-line react/forbid-component-props -- Maintain the close icon's size inside the drawer control. */}
    <XIcon className="size-4" />
    <span className="sr-only">Close</span>
  </SheetPrimitive.Close>
);

export const SheetContent = ({
  children,
  className,
  showCloseButton = true,
  side = "right",
  ...props
}: ComponentProps<typeof SheetPrimitive.Content> & {
  showCloseButton?: boolean;
  side?: SheetSide;
}): JSX.Element => (
  <SheetPrimitive.Portal data-slot="sheet-portal">
    {renderOverlay()}
    <SheetPrimitive.Content
      data-slot="sheet-content"
      // oxlint-disable-next-line react/forbid-component-props -- The native dialog remains responsible for position, backdrop layering, and transitions.
      className={cn(
        "fixed z-50 flex flex-col bg-background shadow-xl outline-none transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:animate-in data-[state=open]:duration-300",
        sideClasses[side],
        className,
      )}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Preserve the Radix dialog's focus, event, attribute, and ref contract.
      {...props}
    >
      {children}
      {showCloseButton && renderCloseButton()}
    </SheetPrimitive.Content>
  </SheetPrimitive.Portal>
);
