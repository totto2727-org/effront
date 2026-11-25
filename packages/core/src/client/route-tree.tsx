"use client";

import type { JSX } from "react";

import type { RouteTreeModel } from "#core/rsc/route-tree.ts";
import { RouteNodeRenderer } from "./route-node-renderer.tsx";

type RouteTreeProps = Readonly<{ root: RouteTreeModel }>;

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function RouteTree({ root }: RouteTreeProps): JSX.Element {
  return <RouteNodeRenderer node={root} />;
}
