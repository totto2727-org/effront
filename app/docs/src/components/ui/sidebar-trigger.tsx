import { useCallback } from "react";
import type { ComponentProps, JSX, MouseEvent } from "react";

import { PanelLeftIcon } from "lucide-react";
import { cn } from "#docs/lib/utils.ts";
import { Button } from "./button.tsx";
import { useSidebar } from "./sidebar-context.ts";

export const SidebarTrigger = ({
  className,
  onClick,
  ...props
}: ComponentProps<typeof Button>): JSX.Element => {
  const { toggleSidebar, triggerRef } = useSidebar();
  const toggle = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      toggleSidebar();
    },
    [onClick, toggleSidebar],
  );
  return (
    <Button
      ref={triggerRef}
      data-sidebar="trigger"
      variant="ghost"
      size="icon"
      // oxlint-disable-next-line react/forbid-component-props -- Specify the sizing of the native trigger and merge caller styles.
      className={cn("size-9", className)}
      onClick={toggle}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- The trigger forwards Button's native event, ARIA, and ref contract.
      {...props}
    >
      <PanelLeftIcon />
      <span className="sr-only">Toggle navigation</span>
    </Button>
  );
};
