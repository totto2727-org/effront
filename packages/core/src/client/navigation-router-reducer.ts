import { Match, Predicate } from "effect";

import {
  candidates,
  flightStates,
  historyEntries,
  navigationInvariant,
  routerCommands,
  routerStates,
  visibleStates,
} from "./navigation-router-model.ts";
import type {
  NavigationCandidate,
  RouterEvent,
  routerEvents,
  RouterState,
  RouterTransition,
} from "./navigation-router-model.ts";
import { reduceVisibleNavigation } from "./navigation-visible-transition.ts";

type Active = ReturnType<typeof routerStates.Navigating>;
type Begin = ReturnType<typeof routerEvents.BeginNavigation>;

const isNavigating = routerStates.$is("Navigating");
const isLoading = candidates.$is("Loading");
const isPublishing = candidates.$is("Publishing");
const isRendering = candidates.$is("Rendering");

const invalidPhase = (event: string, candidate: NavigationCandidate): TypeError =>
  navigationInvariant(
    `${event} cannot follow ${candidates.$match(candidate, {
      Loading: () => "Loading",
      Publishing: () => "Publishing",
      Rendering: () => "Rendering",
    })}.`,
  );

const beginNavigation = (
  previous: RouterState,
  { generation, lifetime }: Begin,
): RouterTransition => {
  const state = routerStates.Navigating({
    candidate: candidates.Loading({ generation, lifetime }),
    visible: previous.visible,
  });
  return isNavigating(previous)
    ? { command: routerCommands.SupersedeCandidate({ candidate: previous.candidate }), state }
    : { state };
};

const closeStaleCommand = (state: RouterState, event: RouterEvent): RouterTransition =>
  Match.value(event).pipe(
    Match.tag("RouteLoaded", ({ resource }) => ({
      command: routerCommands.ReleaseRoute({ resource }),
      state,
    })),
    Match.tag("RenderScheduled", ({ rendererNavigation, resource }) => ({
      command: routerCommands.DiscardRoute({ rendererNavigation, resource }),
      state,
    })),
    Match.orElse(() => ({ state })),
  );

const expectLoading = (
  event: "DocumentLoaded" | "FlightFailed",
  { candidate, visible }: Active,
): RouterTransition => {
  if (!isLoading(candidate)) {
    throw invalidPhase(event, candidate);
  }
  return { state: routerStates.Ready({ visible }) };
};

const routeLoaded = (
  { candidate, visible }: Active,
  { generation, resource }: ReturnType<typeof routerEvents.RouteLoaded>,
): RouterTransition => {
  if (!isLoading(candidate)) {
    throw invalidPhase("RouteLoaded", candidate);
  }
  return {
    command: routerCommands.PublishRoute({ generation, resource }),
    state: routerStates.Navigating({
      candidate: candidates.Publishing({ generation, lifetime: candidate.lifetime, resource }),
      visible,
    }),
  };
};

const renderScheduled = (
  { candidate, visible }: Active,
  { generation, rendererNavigation, resource }: ReturnType<typeof routerEvents.RenderScheduled>,
): RouterTransition => {
  if (!isPublishing(candidate)) {
    throw invalidPhase("RenderScheduled", candidate);
  }
  if (candidate.resource !== resource) {
    throw navigationInvariant("RenderScheduled must use the published route resource.");
  }
  return {
    state: routerStates.Navigating({
      candidate: candidates.Rendering({
        generation,
        lifetime: candidate.lifetime,
        rendererNavigation,
        resource,
      }),
      visible,
    }),
  };
};

const renderCommitted = (
  { candidate }: Active,
  { generation }: ReturnType<typeof routerEvents.RenderCommitted>,
): RouterTransition => {
  if (!isRendering(candidate)) {
    throw invalidPhase("RenderCommitted", candidate);
  }
  return {
    state: routerStates.Ready({
      visible: visibleStates.Navigation({
        entry: historyEntries.PendingCommit(),
        flight: flightStates.Streaming({ resource: candidate.resource }),
        generation,
      }),
    }),
  };
};

const abortNavigation = ({ candidate, visible }: Active): RouterTransition => {
  const state = routerStates.Ready({ visible });
  return candidates.$match(candidate, {
    Loading: () => ({ state }),
    Publishing: ({ resource }) => ({ command: routerCommands.ReleaseRoute({ resource }), state }),
    Rendering: ({ rendererNavigation, resource }) => ({
      command: routerCommands.DiscardRoute({ rendererNavigation, resource }),
      state,
    }),
  });
};

const reduceCurrentCandidate = (state: Active, event: RouterEvent): RouterTransition =>
  Match.value(event).pipe(
    Match.tag("DocumentLoaded", () => expectLoading("DocumentLoaded", state)),
    Match.tag("FlightFailed", () => expectLoading("FlightFailed", state)),
    Match.tag("RouteLoaded", (loaded) => routeLoaded(state, loaded)),
    Match.tag("RenderScheduled", (scheduled) => renderScheduled(state, scheduled)),
    Match.tag("RenderCommitted", (committed) => renderCommitted(state, committed)),
    Match.tag("NavigationAborted", () => abortNavigation(state)),
    Match.orElse(() => ({ state })),
  );

export const reduceRouterState = (state: RouterState, event: RouterEvent): RouterTransition => {
  const active = reduceVisibleNavigation(state, event);
  if (Predicate.isNotNullish(active)) {
    return active;
  }
  return Match.value(event).pipe(
    Match.tag("BeginNavigation", (begin) => beginNavigation(state, begin)),
    Match.orElse((next) => {
      if (!isNavigating(state) || state.candidate.generation !== next.generation) {
        return closeStaleCommand(state, next);
      }
      return reduceCurrentCandidate(state, next);
    }),
  );
};
