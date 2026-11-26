import { Context } from "effect";
import type { ViewTransitionProps } from "react";

/** Serializable React transition classes, optionally selected by transition type. */
export type PageViewTransitionConfig = Readonly<
  Pick<ViewTransitionProps, "default" | "enter" | "exit" | "share" | "update">
> &
  Readonly<{
    /**
     * False removes the page transition boundary. Changing this setting on an
     * already mounted page can reset its local state. Live reduced-motion
     * preference changes preserve the boundary and page state instead.
     */
    enabled?: boolean | undefined;
  }>;

const builtInDefaults: PageViewTransitionConfig = Object.freeze({
  default: Object.freeze({
    default: "auto",
    "hmr-refresh": "none",
    "navigation-ua-visual-transition": "none",
  }),
});

/** Request-local page transition settings. Provide a Layer to override the defaults. */
export const PageViewTransition = Context.Reference<PageViewTransitionConfig>(
  "effront/application/page-view-transition/PageViewTransition",
  { defaultValue: () => builtInDefaults },
);

/**
 * Selects the public serializable settings that Flight uses.
 * @param {PageViewTransitionConfig} defaults The request-local transition defaults.
 * @param {false | PageViewTransitionConfig | undefined} override The Page transition configuration.
 * @returns {PageViewTransitionConfig} The resolved transition settings for this page.
 */
export const resolvePageViewTransition = (
  defaults: PageViewTransitionConfig,
  override: false | PageViewTransitionConfig | undefined,
): PageViewTransitionConfig => {
  if (override === false) {
    return { enabled: false };
  }
  const {
    enabled,
    default: defaultClass,
    enter,
    exit,
    share,
    update,
  } = {
    ...builtInDefaults,
    ...defaults,
    ...override,
  };
  return { default: defaultClass, enabled, enter, exit, share, update };
};
