import { Function, Match, Predicate } from "effect";

import {
  flightStates,
  historyEntries,
  navigationInvariant,
  routerCommands,
  visibleStates,
  withVisible,
} from "./navigation-router-model.ts";
import type { RouterEvent, RouterState, RouterTransition } from "./navigation-router-model.ts";

type VisibleRun = ReturnType<typeof visibleStates.Navigation>;
type CommittedHistory = ReturnType<typeof historyEntries.Committed>;
type StreamingFlight = ReturnType<typeof flightStates.Streaming>;

const isActiveNavigation = visibleStates.$is("Navigation");
const isHistoryCommitted = historyEntries.$is("Committed");
const isStreaming = flightStates.$is("Streaming");

const retire = (state: RouterState): RouterState => withVisible(state, visibleStates.Settled());

const onHistoryCommitted = (
  state: RouterState,
  { entry, flight, generation }: VisibleRun,
  nextEntry: CommittedHistory["entry"],
): RouterTransition => {
  if (isHistoryCommitted(entry)) {
    throw navigationInvariant("A visible navigation history entry cannot commit twice.");
  }
  if (isStreaming(flight)) {
    return {
      state: withVisible(
        state,
        visibleStates.Navigation({
          entry: historyEntries.Committed({ entry: nextEntry }),
          flight,
          generation,
        }),
      ),
    };
  }

  const settled = retire(state);
  return Predicate.isNullish(nextEntry)
    ? { state: settled }
    : {
        command: routerCommands.CacheRoute({ cache: flight.cache, entry: nextEntry }),
        state: settled,
      };
};

const completeStreamingFlight = (
  state: RouterState,
  { entry, generation }: VisibleRun,
  { resource }: StreamingFlight,
): RouterTransition => {
  const release = routerCommands.ReleaseRoute({ resource });
  if (!isHistoryCommitted(entry)) {
    return {
      command: release,
      state: withVisible(
        state,
        visibleStates.Navigation({
          entry,
          flight: flightStates.Completed({ cache: resource.cache }),
          generation,
        }),
      ),
    };
  }

  const command = Predicate.isNullish(entry.entry)
    ? release
    : routerCommands.CacheAndReleaseRoute({ entry: entry.entry, resource });
  return { command, state: retire(state) };
};

const onFlightCompleted = (state: RouterState, visible: VisibleRun): RouterTransition => {
  if (!isStreaming(visible.flight)) {
    throw navigationInvariant("A visible navigation Flight stream cannot complete twice.");
  }
  return completeStreamingFlight(state, visible, visible.flight);
};

const onFlightFailed = (state: RouterState, visible: VisibleRun): RouterTransition => {
  if (!isStreaming(visible.flight)) {
    throw navigationInvariant("A completed visible Flight stream cannot fail.");
  }
  return {
    command: routerCommands.ReleaseRoute({ resource: visible.flight.resource }),
    state: retire(state),
  };
};

export const reduceVisibleNavigation = (
  state: RouterState,
  event: RouterEvent,
): RouterTransition | undefined => {
  const { visible } = state;
  return isActiveNavigation(visible) && visible.generation === event.generation
    ? Match.value(event).pipe(
        Match.tag("RenderRetired", () => ({ state: retire(state) })),
        Match.tag("HistoryCommitted", ({ entry }) => onHistoryCommitted(state, visible, entry)),
        Match.tag("FlightCompleted", () => onFlightCompleted(state, visible)),
        Match.tag("FlightFailed", () => onFlightFailed(state, visible)),
        Match.orElse(Function.constUndefined),
      )
    : undefined;
};
