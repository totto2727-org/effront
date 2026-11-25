import { createContext } from "react";

import type { RouteTreeModel } from "#core/rsc/route-tree.ts";

export const RouteNodeContext = createContext<RouteTreeModel | undefined>(undefined);
