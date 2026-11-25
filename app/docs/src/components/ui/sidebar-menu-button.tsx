import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { Predicate, String } from "effect";
import { Slot } from "radix-ui";
import type { ComponentProps, JSX } from "react";

import { cn } from "#docs/lib/utils.ts";
import { useSidebar } from "./sidebar-context.ts";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip.tsx";

const menuButtonVariants = cva(
  "flex min-h-8 w-full items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-left text-sm wrap-break-word outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium",
  {
    defaultVariants: { size: "default" },
    variants: { size: { default: "min-h-8 h-auto", sm: "min-h-7 h-auto text-xs" } },
  },
);

type SidebarMenuButtonProps = ComponentProps<"button"> &
  VariantProps<typeof menuButtonVariants> & {
    asChild?: boolean;
    isActive?: boolean;
    tooltip?: string;
  };

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function SidebarMenuButton({
  asChild = false,
  isActive = false,
  className,
  size,
  tooltip,
  ...props
}: SidebarMenuButtonProps): JSX.Element {
  const Comp = asChild ? Slot.Root : "button";
  const { isMobile, state } = useSidebar();
  const button = (
    <Comp
      data-sidebar="menu-button"
      data-active={isActive}
      // oxlint-disable-next-line react/forbid-component-props -- The native button or slotted link needs the sidebar styles.
      className={cn(menuButtonVariants({ size }), className)}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Slot composition must forward the incoming native props and ref.
      {...props}
    />
  );
  if (Predicate.isNullish(tooltip) || String.isEmpty(tooltip)) {
    return button;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" hidden={state !== "collapsed" || isMobile}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
