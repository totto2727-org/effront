import { handleNavigation, runNavigationCleanup } from "./navigation-lifecycle.ts";
import type { NavigationContext, NavigationRequest } from "./navigation-request.ts";
import { executeRouterCommand } from "./navigation-router-command.ts";
import { routerEvents } from "./navigation-router-model.ts";
import { isRoutedNavigation } from "./navigation-routing.ts";
import { getLinkTransitionTypes } from "./navigation-transition-types.ts";

type Interception = Readonly<{ lifetime: AbortController; request: NavigationRequest }>;

const prepareInterception = (event: NavigateEvent): Interception => {
  const destination = new URL(event.destination.url);
  const linkTransitionTypes = getLinkTransitionTypes(event);
  const generation = Symbol("NavigationGeneration");
  const lifetime = new AbortController();
  return {
    lifetime,
    request: {
      destination,
      event,
      generation,
      linkTransitionTypes,
      signal: AbortSignal.any([event.signal, lifetime.signal]),
    },
  };
};

export const makeNavigateListener =
  (context: NavigationContext): ((event: NavigateEvent) => void) =>
  (event) => {
    if (!isRoutedNavigation(event)) {
      return;
    }
    const { lifetime, request } = prepareInterception(event);
    const { generation } = request;
    const begin = context.dispatch(routerEvents.BeginNavigation({ generation, lifetime }));
    runNavigationCleanup(context.run, executeRouterCommand(begin.command));
    const handler = async (precommit?: NavigationPrecommitController): Promise<void> =>
      handleNavigation(context, request, precommit);
    // Browsers make some traversals non-cancelable so an application cannot trap users.
    const options = event.cancelable ? { precommitHandler: handler } : { handler };
    event.intercept(options);
  };
