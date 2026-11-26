import type { ComponentProps, JSX } from "react";

import { cn } from "#docs/lib/utils.ts";

type BlockProps = ComponentProps<"div">;
type SidebarBlock = Readonly<{
  classes: string;
  name?: string;
  slot: string;
}>;

const renderBlock = (
  { classes, name, slot }: SidebarBlock,
  { className, ...props }: BlockProps,
): JSX.Element => (
  <div
    data-sidebar={name}
    data-slot={slot}
    className={cn(classes, className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Sidebar blocks expose native div attributes and refs.
    {...props}
  />
);

export const SidebarInset = (props: BlockProps): JSX.Element =>
  renderBlock(
    {
      classes: "relative flex w-full min-w-0 flex-1 flex-col bg-background",
      slot: "sidebar-inset",
    },
    props,
  );

export const SidebarHeader = (props: BlockProps): JSX.Element =>
  renderBlock(
    { classes: "flex flex-col gap-2 p-3", name: "header", slot: "sidebar-header" },
    props,
  );

export const SidebarContent = (props: BlockProps): JSX.Element =>
  renderBlock(
    {
      classes: "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden",
      name: "content",
      slot: "sidebar-content",
    },
    props,
  );

export const SidebarFooter = (props: BlockProps): JSX.Element =>
  renderBlock(
    { classes: "flex flex-col gap-2 p-3", name: "footer", slot: "sidebar-footer" },
    props,
  );

export const SidebarGroup = (props: BlockProps): JSX.Element =>
  renderBlock(
    {
      classes: "flex w-full min-w-0 flex-col px-3 py-2",
      name: "group",
      slot: "sidebar-group",
    },
    props,
  );

export const SidebarGroupLabel = (props: BlockProps): JSX.Element =>
  renderBlock(
    {
      classes:
        "px-2 pb-1 text-[0.68rem] font-semibold tracking-[0.14em] text-sidebar-foreground/55 uppercase",
      name: "group-label",
      slot: "sidebar-group-label",
    },
    props,
  );
