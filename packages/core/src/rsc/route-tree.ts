import type { ReactNode } from "react";

export type RouteTreeModel = Readonly<{
  child: RouteTreeModel | null;
  content: ReactNode;
  id: string;
}>;
