import type { ComponentProps, JSX } from "react";

import { cn } from "#docs/lib/utils.ts";
import { Skeleton } from "./skeleton.tsx";

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function SidebarMenuSkeleton({ className, ...props }: ComponentProps<"div">): JSX.Element {
  return (
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
}
