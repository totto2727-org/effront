import type { ComponentProps, JSX } from "react";

import { cn } from "#docs/lib/utils.ts";
import { Skeleton } from "./skeleton.tsx";

export const SidebarMenuSkeleton = ({
  className,
  ...props
}: ComponentProps<"div">): JSX.Element => (
  <div
    data-sidebar="menu-skeleton"
    className={cn("flex h-8 items-center gap-2 px-2", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Preserve native div props and ref.
    {...props}
  >
    {/* oxlint-disable-next-line react/forbid-component-props -- Size the placeholder to match typical menu text. */}
    <Skeleton className="h-3 w-3/4" />
  </div>
);
