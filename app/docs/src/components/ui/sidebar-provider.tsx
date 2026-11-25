import { Predicate } from "effect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps, CSSProperties, JSX } from "react";

import { cn } from "#docs/lib/utils.ts";
import { SidebarContext } from "./sidebar-context.ts";
import type { SidebarContextProps, SidebarOpenUpdate } from "./sidebar-context.ts";
import { TooltipProvider } from "./tooltip.tsx";
import { useIsMobile } from "./use-mobile.ts";

type OpenStateProps = Readonly<{
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}>;
type SidebarProviderProps = ComponentProps<"div"> & OpenStateProps;
type SidebarStyle = CSSProperties & {
  "--sidebar-width": string;
  "--sidebar-width-icon": string;
};

const sidebarWidth = "17rem";
const sidebarIconWidth = "3rem";
const sidebarCookieLifetime = 604_800;

const useDesktopOpen = ({
  defaultOpen = true,
  onOpenChange,
  open: openProp,
}: OpenStateProps): Readonly<Pick<SidebarContextProps, "open" | "setOpen">> => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = useCallback(
    (value: SidebarOpenUpdate) => {
      const next = Predicate.isFunction(value) ? value(open) : value;
      if (Predicate.isNullish(onOpenChange)) {
        setUncontrolledOpen(next);
      } else {
        onOpenChange(next);
      }
      // oxlint-disable-next-line unicorn/no-document-cookie -- The existing state cookie is written synchronously during the browser interaction.
      document.cookie = `sidebar_state=${next}; path=/; max-age=${sidebarCookieLifetime}`;
    },
    [open, onOpenChange],
  );
  return { open, setOpen };
};

const useSidebarShortcut = (toggleSidebar: () => void): void => {
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (event.key === "b" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    globalThis.addEventListener("keydown", handler);
    return () => {
      globalThis.removeEventListener("keydown", handler);
    };
  }, [toggleSidebar]);
};

const useSidebarController = (props: OpenStateProps): SidebarContextProps => {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { open, setOpen } = useDesktopOpen(props);
  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setOpenMobile(!openMobile);
    } else {
      setOpen((value) => !value);
    }
  }, [isMobile, openMobile, setOpen]);
  useSidebarShortcut(toggleSidebar);
  return useMemo<SidebarContextProps>(
    () => ({
      isMobile,
      open,
      openMobile,
      setOpen,
      setOpenMobile,
      state: open ? "expanded" : "collapsed",
      toggleSidebar,
      triggerRef,
    }),
    [isMobile, open, openMobile, setOpen, toggleSidebar],
  );
};

const renderWrapper = ({
  className,
  children,
  style,
  ...props
}: ComponentProps<"div">): JSX.Element => (
  <div
    data-slot="sidebar-wrapper"
    style={style}
    className={cn("group/sidebar-wrapper flex min-h-svh w-full", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- SidebarProvider accepts the full native div attribute and ref contract.
    {...props}
  >
    {children}
  </div>
);

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function SidebarProvider({
  defaultOpen,
  open,
  onOpenChange,
  style,
  ...wrapper
}: SidebarProviderProps): JSX.Element {
  const context = useSidebarController({ defaultOpen, onOpenChange, open });
  const wrapperStyle = useMemo<SidebarStyle>(
    () => ({
      "--sidebar-width": sidebarWidth,
      "--sidebar-width-icon": sidebarIconWidth,
      ...style,
    }),
    [style],
  );
  return (
    <SidebarContext.Provider value={context}>
      <TooltipProvider delayDuration={0}>
        {renderWrapper({ ...wrapper, style: wrapperStyle })}
      </TooltipProvider>
    </SidebarContext.Provider>
  );
}
