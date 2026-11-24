import { Data } from "effect";

import type { BrowserRendererNavigation } from "./browser-renderer.ts";
import type { RouteResource } from "./route-loader.ts";

// oxlint-disable-next-line typescript/no-generated-empty-object-type -- Effect represents payload-free tags with an empty record.
type NoPayload = Record<never, never>;
type NavigationGeneration = symbol;
type HistoryEntry = NavigationHistoryEntry | null;

type EntryState = Data.TaggedEnum<{
  Committed: { entry: HistoryEntry };
  PendingCommit: NoPayload;
}>;
export const historyEntries = Data.taggedEnum<EntryState>();

type FlightState = Data.TaggedEnum<{
  Completed: { cache: RouteResource["cache"] };
  Streaming: { resource: RouteResource };
}>;
export const flightStates = Data.taggedEnum<FlightState>();

type CandidateLifetime = Readonly<{ generation: NavigationGeneration; lifetime: AbortController }>;
type CandidateResource = CandidateLifetime & Readonly<{ resource: RouteResource }>;

export type NavigationCandidate = Data.TaggedEnum<{
  Loading: CandidateLifetime;
  Publishing: CandidateResource;
  Rendering: CandidateResource & { rendererNavigation: BrowserRendererNavigation };
}>;
export const candidates = Data.taggedEnum<NavigationCandidate>();

export type VisibleNavigation = Data.TaggedEnum<{
  Navigation: { entry: EntryState; flight: FlightState; generation: NavigationGeneration };
  Settled: NoPayload;
}>;
export const visibleStates = Data.taggedEnum<VisibleNavigation>();

export type RouterState = Data.TaggedEnum<{
  Navigating: { candidate: NavigationCandidate; visible: VisibleNavigation };
  Ready: { visible: VisibleNavigation };
}>;
export const routerStates = Data.taggedEnum<RouterState>();

type GenerationEvent = Readonly<{ generation: NavigationGeneration }>;
type LoadedEvent = GenerationEvent & Readonly<{ resource: RouteResource }>;
export type RouterEvent = Data.TaggedEnum<{
  BeginNavigation: CandidateLifetime;
  DocumentLoaded: GenerationEvent;
  FlightCompleted: GenerationEvent;
  FlightFailed: GenerationEvent;
  HistoryCommitted: GenerationEvent & { entry: HistoryEntry };
  NavigationAborted: GenerationEvent;
  RenderCommitted: GenerationEvent;
  RenderRetired: GenerationEvent;
  RenderScheduled: LoadedEvent & { rendererNavigation: BrowserRendererNavigation };
  RouteLoaded: LoadedEvent;
}>;
export const routerEvents = Data.taggedEnum<RouterEvent>();

export type RouterCommand = Data.TaggedEnum<{
  CacheAndReleaseRoute: { entry: NavigationHistoryEntry; resource: RouteResource };
  CacheRoute: { cache: RouteResource["cache"]; entry: NavigationHistoryEntry };
  DiscardRoute: { rendererNavigation: BrowserRendererNavigation; resource: RouteResource };
  PublishRoute: LoadedEvent;
  ReleaseRoute: { resource: RouteResource };
  SupersedeCandidate: { candidate: NavigationCandidate };
}>;
export const routerCommands = Data.taggedEnum<RouterCommand>();

export type RouterTransition = Readonly<{
  command?: RouterCommand;
  state: RouterState;
}>;

export const initialRouterState = (): RouterState =>
  routerStates.Ready({ visible: visibleStates.Settled() });

export const withVisible = (state: RouterState, visible: VisibleNavigation): RouterState =>
  routerStates.$match(state, {
    Navigating: ({ candidate }) => routerStates.Navigating({ candidate, visible }),
    Ready: () => routerStates.Ready({ visible }),
  });

export const navigationInvariant = (message: string): TypeError =>
  // oxlint-disable-next-line rules/require-tagged-error -- Router protocol violations expose the native TypeError to the Navigation API.
  new TypeError(message);
