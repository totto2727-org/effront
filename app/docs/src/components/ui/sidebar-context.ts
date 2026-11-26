import { Data, Predicate } from "effect";
import { createContext, useContext } from "react";
import type { RefObject } from "react";

export type SidebarOpenUpdate = boolean | ((value: boolean) => boolean);

export type SidebarContextProps = Readonly<{
  isMobile: boolean;
  open: boolean;
  openMobile: boolean;
  setOpen: (value: SidebarOpenUpdate) => void;
  setOpenMobile: (open: boolean) => void;
  state: "expanded" | "collapsed";
  toggleSidebar: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}>;

export const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

class MissingSidebarProvider extends Data.TaggedError("MissingSidebarProvider")<{
  message: string;
}> {}

export const useSidebar = (): SidebarContextProps => {
  const context = useContext(SidebarContext);
  if (Predicate.isNullish(context)) {
    throw new MissingSidebarProvider({
      message: "useSidebar must be used within a SidebarProvider.",
    });
  }
  return context;
};
