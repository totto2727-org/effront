import type { ComponentProps, JSX } from "react";

import { cn } from "#docs/lib/utils.ts";
import { Input } from "./input.tsx";

export const SidebarInput = ({
  className,
  ...props
}: ComponentProps<typeof Input>): JSX.Element => (
  <Input
    data-sidebar="input"
    // oxlint-disable-next-line react/forbid-component-props -- The sidebar supplies the native input height and background.
    className={cn("h-8 bg-background", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward the input's native event, ARIA, and ref contract.
    {...props}
  />
);
