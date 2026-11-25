"use client";

import { useSyncExternalStore, ViewTransition } from "react";
import type { ReactNode } from "react";

import type { PageViewTransitionConfig } from "#core/application/page-view-transition.ts";

// oxlint-disable-next-line import/no-unassigned-import -- The client boundary must load its View Transition styles with the component.
import "./page-view-transition.css";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
const subscribe = (onChange: () => void): (() => void) => {
  const query = globalThis.matchMedia(reducedMotionQuery);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
};
const getSnapshot = (): boolean => globalThis.matchMedia(reducedMotionQuery).matches;
const getServerSnapshot = (): boolean => false;

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function PageViewTransitionBoundary({
  children,
  config,
}: Readonly<{
  children?: ReactNode;
  config: PageViewTransitionConfig;
}>): ReactNode {
  const reducedMotion = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (config.enabled === false) {
    return children;
  }

  return (
    <ViewTransition
      name="effront-page"
      default={reducedMotion ? "none" : config.default}
      enter={reducedMotion ? "none" : config.enter}
      exit={reducedMotion ? "none" : config.exit}
      share={reducedMotion ? "none" : config.share}
      update={reducedMotion ? "none" : config.update}
    >
      {children}
    </ViewTransition>
  );
}
