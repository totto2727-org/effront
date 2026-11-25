"use client";

import { Predicate } from "effect";
import { use } from "react";
import type { JSX } from "react";

import { RouteNodeContext } from "./route-node-context.ts";
import { RouteNodeRenderer } from "./route-node-renderer.tsx";

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function RouteOutlet(): JSX.Element | null {
  const node = use(RouteNodeContext);
  if (Predicate.isNullish(node)) {
    // oxlint-disable-next-line rules/require-tagged-error -- Misusing the outlet retains its native synchronous TypeError in React.
    throw new TypeError("RouteOutlet rendered outside its route node.");
  }
  const { child } = node;
  return Predicate.isNullish(child) ? child : <RouteNodeRenderer key={child.id} node={child} />;
}
