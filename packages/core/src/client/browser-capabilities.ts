import { Effect, Predicate } from "effect";

type NavigationWindow = Partial<
  Pick<Window & typeof globalThis, "navigation" | "NavigationPrecommitController">
>;

const host: Readonly<{ window?: NavigationWindow }> = globalThis;

export const navigationMode = Effect.sync(() => {
  const { window } = host;
  return Predicate.isNotNullish(window?.navigation) &&
    Predicate.isNotNullish(window.NavigationPrecommitController)
    ? ("Client" as const)
    : ("Document" as const);
});
