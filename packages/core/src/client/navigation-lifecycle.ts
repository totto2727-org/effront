import { Effect, Exit, Predicate } from "effect";
import { startTransition } from "react";

import { prepareNavigation } from "./navigation-preparation.ts";
import type {
  NavigationContext,
  NavigationPreparation,
  NavigationRequest,
} from "./navigation-request.ts";
import { preparations } from "./navigation-request.ts";
import { executeRouterCommand } from "./navigation-router-command.ts";
import { routerEvents } from "./navigation-router-model.ts";
import type { RouterEvent } from "./navigation-router-model.ts";

type Run = NavigationContext["run"];
type Dispatch = NavigationContext["dispatch"];
type Rendered = ReturnType<typeof preparations.Rendered>;
type Lifecycle = Readonly<{
  abort: Effect.Effect<void>;
  precommit: NavigationPrecommitController | undefined;
}>;

const isHandled = preparations.$is("Handled");

const dispatchEffect = (dispatch: Dispatch, event: RouterEvent): Effect.Effect<void> =>
  Effect.suspend(() => executeRouterCommand(dispatch(event).command));

export const runNavigationCleanup = (run: Run, cleanup: Effect.Effect<void>): void => {
  const observe = async (): Promise<void> => {
    try {
      await run(cleanup);
    } catch {
      // Navigation cleanup is best effort after the browser scope has been released.
    }
  };
  // oxlint-disable-next-line typescript/no-floating-promises -- The synchronously dispatched browser event cannot await cleanup.
  observe();
};

// oxlint-disable-next-line typescript/promise-function-async -- Keep the precise Promise resolved by the React Transition Action.
const startFlightTransition = (
  context: NavigationContext,
  request: NavigationRequest,
  precommit: NavigationPrecommitController | undefined,
): Promise<NavigationPreparation> => {
  const { run } = context;
  const { signal } = request;
  const pending = Promise.withResolvers<NavigationPreparation>();
  startTransition(async () => {
    try {
      const outcome = await run(prepareNavigation(context, request, precommit), { signal });
      pending.resolve(outcome);
    } catch (error) {
      pending.reject(error);
    }
  });
  return pending.promise;
};

const awaitPreparation = async (
  context: NavigationContext,
  request: NavigationRequest,
  { abort, precommit }: Lifecycle,
): Promise<NavigationPreparation> => {
  const { event, signal } = request;
  const { navigation, run } = context;

  try {
    return await startFlightTransition(context, request, precommit);
  } catch (error) {
    if (signal.aborted) {
      return run(Effect.as(abort, preparations.Handled()));
    }
    if (!event.cancelable && event.navigationType === "traverse") {
      navigation.reloadDocument();
      return preparations.Handled();
    }
    throw error;
  }
};

const waitForPublication = async (
  { dispatch, run }: NavigationContext,
  { generation, signal }: NavigationRequest,
  { rendererNavigation, abort }: Pick<Rendered, "rendererNavigation"> & Pick<Lifecycle, "abort">,
): Promise<boolean> => {
  // oxlint-disable-next-line typescript/promise-function-async -- The renderer owns the original publication acknowledgement promise.
  const committed = Effect.promise(() => rendererNavigation.committed);
  const publish = dispatchEffect(dispatch, routerEvents.RenderCommitted({ generation }));
  const wait = Effect.uninterruptibleMask((restore) =>
    restore(committed).pipe(
      Effect.tap(publish),
      Effect.onExit((exit) => (Exit.isFailure(exit) ? abort : Effect.void)),
    ),
  );
  try {
    await run(wait, { signal });
    return true;
  } catch (error) {
    if (signal.aborted) {
      return false;
    }
    throw error;
  }
};

const watchVisibleNavigation = (
  { dispatch, run }: NavigationContext,
  generation: symbol,
  { rendererNavigation, resource }: Rendered,
): void => {
  const retire = Effect.gen(function* () {
    // oxlint-disable-next-line typescript/promise-function-async -- Cleanup waits on the original retirement acknowledgement.
    yield* Effect.promise(() => rendererNavigation.retired);
    dispatch(routerEvents.RenderRetired({ generation }));
  }).pipe(
    // A later generation may already be active when this render retires.
    Effect.ensuring(resource.release),
    Effect.ignore,
  );
  runNavigationCleanup(run, retire);

  const finishFlight = Effect.gen(function* () {
    const flight = yield* Effect.exit(resource.completed);
    const finished = Exit.isSuccess(flight)
      ? routerEvents.FlightCompleted({ generation })
      : routerEvents.FlightFailed({ generation });
    yield* dispatchEffect(dispatch, finished);
  });
  runNavigationCleanup(run, finishFlight);
};

const commitHistory = async (
  { dispatch, navigation, run }: NavigationContext,
  { destination, generation }: NavigationRequest,
  {
    precommit,
    resolvedDestination,
  }: Pick<Lifecycle, "precommit"> & Pick<Rendered, "resolvedDestination">,
): Promise<void> => {
  const commit = Effect.suspend(() =>
    dispatchEffect(
      dispatch,
      routerEvents.HistoryCommitted({ entry: navigation.getCurrentEntry(), generation }),
    ),
  );
  if (Predicate.isNullish(precommit)) {
    await run(commit);
    return;
  }
  if (destination.href !== resolvedDestination.href) {
    precommit.redirect(resolvedDestination.href, { history: "auto" });
  }
  // oxlint-disable-next-line typescript/promise-function-async -- The Navigation API waits on the browser runtime's promise.
  precommit.addHandler(() => run(commit));
};

export const handleNavigation = async (
  context: NavigationContext,
  request: NavigationRequest,
  precommit?: NavigationPrecommitController,
): Promise<void> => {
  const { generation } = request;
  const abort = dispatchEffect(context.dispatch, routerEvents.NavigationAborted({ generation }));
  const outcome = await awaitPreparation(context, request, { abort, precommit });
  if (isHandled(outcome)) {
    return;
  }
  const published = await waitForPublication(context, request, {
    abort,
    rendererNavigation: outcome.rendererNavigation,
  });
  if (published) {
    watchVisibleNavigation(context, generation, outcome);
    await commitHistory(context, request, {
      precommit,
      resolvedDestination: outcome.resolvedDestination,
    });
  }
};
