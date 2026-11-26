import type { JSX } from "react";

import type { RouteTreeModel } from "#core/rsc/route-tree.ts";
import { RouteNodeContext } from "./route-node-context.ts";

type RouteNodeRendererProps = Readonly<{ node: RouteTreeModel }>;

export const RouteNodeRenderer = ({ node }: RouteNodeRendererProps): JSX.Element => (
  <RouteNodeContext value={node}>{node.content}</RouteNodeContext>
);
