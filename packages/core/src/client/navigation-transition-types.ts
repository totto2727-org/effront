import { Array, Predicate } from "effect";

const reservedTransitionTypes = new Set(["navigation", "server-function", "hmr-refresh"]);

const isApplicationTransitionType = (type: string): boolean =>
  !reservedTransitionTypes.has(type) && !type.startsWith("navigation-");

export const getLinkTransitionTypes = (event: NavigateEvent): Readonly<string[]> => {
  if (
    (event.navigationType !== "push" && event.navigationType !== "replace") ||
    !(event.sourceElement instanceof globalThis.HTMLAnchorElement)
  ) {
    return [];
  }
  const types = event.sourceElement.dataset["effrontTransitionTypes"]?.match(/\S+/gu) ?? [];
  return Array.dedupe(Array.filter(types, isApplicationTransitionType));
};

export const getNavigationTransitionTypes = (
  event: NavigateEvent,
  fromIndex: number | null,
): Readonly<string[]> => {
  const types = [
    "navigation",
    `navigation-${event.navigationType}`,
    ...(event.hasUAVisualTransition ? ["navigation-ua-visual-transition"] : []),
  ];
  if (event.navigationType === "push") {
    return [...types, "navigation-forward"];
  }
  if (event.navigationType !== "traverse") {
    return types;
  }

  if (Predicate.isNullish(fromIndex) || fromIndex === event.destination.index) {
    return types;
  }
  return [
    ...types,
    event.destination.index < fromIndex ? "navigation-backward" : "navigation-forward",
  ];
};
