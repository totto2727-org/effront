import { Array, Effect, Option, Predicate } from "effect";

import { makeNavigationEvent } from "./client-routing-events.fixture.ts";
import type { TestNavigationApi } from "./client-routing-navigation.fixture.ts";

type RecordedRedirect = Readonly<{
  options: NavigationNavigateOptions | undefined;
  url: string;
}>;

export const makePrecommitController = (
  redirects: RecordedRedirect[] = [],
  handlers: NavigationInterceptHandler[] = [],
): NavigationPrecommitController => ({
  addHandler: (handler) => {
    handlers.push(handler);
  },
  redirect: (url, options) => {
    redirects.push({ options, url: url.toString() });
  },
});

// oxlint-disable-next-line typescript/promise-function-async -- Observe the exact promise produced by the browser handler.
export const invokeNavigationHandler = (handler: NavigationInterceptHandler): Promise<void> =>
  Promise.resolve(handler());

// oxlint-disable-next-line typescript/promise-function-async -- Observe the exact promise produced by the browser precommit handler.
export const invokePrecommitHandler = (
  handler: NavigationPrecommitHandler,
  controller: NavigationPrecommitController,
): Promise<void> => Promise.resolve(handler(controller));

export const runPrecommit = Effect.fn("effront.test.runPrecommit")(function* (
  interception: NavigationInterceptOptions | null,
  controller: NavigationPrecommitController,
) {
  const handler = interception?.precommitHandler;
  if (Predicate.isNullish(handler)) {
    return yield* Effect.die("Expected a precommit handler.");
  }
  // oxlint-disable-next-line typescript/promise-function-async -- The fixture observes the handler's original acknowledgement promise.
  return yield* Effect.promise(() => invokePrecommitHandler(handler, controller));
});

export const prepareNavigation = Effect.fn("effront.test.prepareNavigation")(function* (
  navigation: TestNavigationApi,
  url: string,
) {
  const pendingNavigation = makeNavigationEvent({ destination: { url } });
  navigation.dispatch(pendingNavigation.event);
  const handlers: NavigationInterceptHandler[] = [];
  const controller = makePrecommitController([], handlers);
  yield* runPrecommit(pendingNavigation.interception(), controller);
  const handler = Array.head(handlers);
  if (Option.isNone(handler)) {
    return yield* Effect.die("Expected a post-commit handler.");
  }
  return handler.value;
});
