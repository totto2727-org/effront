import type { JSX } from "react";

import type { RouteTreeModel } from "#core/rsc/route-tree.ts";
import { RouteNodeContext } from "./route-node-context.ts";

type RouteNodeRendererProps = Readonly<{ node: RouteTreeModel }>;

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function RouteNodeRenderer({ node }: RouteNodeRendererProps): JSX.Element {
  return <RouteNodeContext value={node}>{node.content}</RouteNodeContext>;
}
