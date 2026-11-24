import { Data } from "effect";
import type { Effect, MutableRef, Option } from "effect";

import type { RouteTreeModel } from "#core/rsc/route-tree.ts";

type Completed = Effect.Success<typeof Effect.void>;

export type BrowserRendererNavigation = Readonly<{
  committed: Promise<void>;
  discard: () => Promise<void>;
  retired: Promise<void>;
}>;

type RouteFields = Readonly<{
  committed: PromiseWithResolvers<Completed>;
  order: number;
  retired: PromiseWithResolvers<Completed>;
  routeTree: RouteTreeModel;
}>;

type VisibleCases = Readonly<{
  Initial: { routeTree: RouteTreeModel };
  Navigation: RouteFields;
  Refresh: RouteFields;
}>;

export type VisibleRender = Data.TaggedEnum<VisibleCases>;
export type BrowserRender = Data.TaggedEnum<
  VisibleCases & { Discard: { order: number; restore: VisibleRender } }
>;
export type RouteRender = Extract<BrowserRender, Readonly<{ committed: unknown }>>;

export const renders = Data.taggedEnum<BrowserRender>();
export const isInitial = renders.$is("Initial");
export const isDiscard = renders.$is("Discard");

export const nextRouteRender = (
  kind: "Navigation" | "Refresh",
  routeTree: RouteTreeModel,
  order: number,
): RouteRender => {
  const fields = {
    committed: Promise.withResolvers<Completed>(),
    order,
    retired: Promise.withResolvers<Completed>(),
    routeTree,
  };
  return kind === "Navigation" ? renders.Navigation(fields) : renders.Refresh(fields);
};

type LiveRender = Readonly<{
  lastPublicationOrder: number;
  phase: "Scheduled" | "DiscardRequested" | "Committed";
}>;

export type ReadyRenderer = Readonly<{
  current: MutableRef.MutableRef<BrowserRender>;
  liveRenders: Map<RouteRender, LiveRender>;
  publicationOrder: MutableRef.MutableRef<number>;
  publish: (render: BrowserRender) => void;
}>;

export type RendererReadiness = MutableRef.MutableRef<Option.Option<ReadyRenderer>>;
