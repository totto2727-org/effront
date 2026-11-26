"use client";

import type { JSX } from "react";

import type { RouteTreeModel } from "#core/rsc/route-tree.ts";
import { RouteNodeRenderer } from "./route-node-renderer.tsx";

type RouteTreeProps = Readonly<{ root: RouteTreeModel }>;

export const RouteTree = ({ root }: RouteTreeProps): JSX.Element => (
  <RouteNodeRenderer node={root} />
);
