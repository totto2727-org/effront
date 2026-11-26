import { Data, Function, MutableRef, Option } from "effect";
import type { Effect } from "effect";

import { BrowserRenderer } from "#core/client/browser-renderer.ts";
import type { BrowserRendererNavigation } from "#core/client/browser-renderer.ts";
import type { RouteTreeModel } from "#core/rsc/route-tree.ts";

// oxlint-disable-next-line unicorn/no-null -- An empty route has a null child and a null content slot in the Flight protocol.
const emptyFlightSlot = null;
export const initialRouteTree: RouteTreeModel = {
  child: emptyFlightSlot,
  content: emptyFlightSlot,
  id: "day-one",
};

type RenderFields = Readonly<{ routeTree: RouteTreeModel }>;
export type BrowserRenderRequest = Data.TaggedEnum<{
  Navigation: RenderFields;
  ServerFunction: RenderFields;
}>;
export const renderRequests = Data.taggedEnum<BrowserRenderRequest>();
const isNavigation = renderRequests.$is("Navigation");

type Completed = Effect.Success<typeof Effect.void>;
type PendingRender = PromiseWithResolvers<Completed>;

const retireAfterCommit = async (previous: Option.Option<PendingRender>): Promise<void> => {
  await Promise.resolve();
  if (Option.isSome(previous)) {
    previous.value.resolve();
  }
};

// oxlint-disable-next-line typescript/promise-function-async -- This fixture discards synchronously and returns a settled acknowledgement.
const discard = (): Promise<void> => Promise.resolve();

export const makeBrowserRenderer = (
  renders: BrowserRenderRequest[] = [],
): typeof BrowserRenderer.Service => {
  const visible = MutableRef.make(Option.none<PendingRender>());
  const publish = (request: BrowserRenderRequest): BrowserRendererNavigation => {
    const previous = MutableRef.get(visible);
    const current = Promise.withResolvers<Completed>();
    MutableRef.set(visible, isNavigation(request) ? Option.some(current) : Option.none());
    renders.push(request);
    return {
      committed: retireAfterCommit(previous),
      discard,
      retired: current.promise,
    };
  };
  return BrowserRenderer.of({
    commit: Function.constVoid,
    initialize: Function.constVoid,
    navigate: (routeTree) => publish(renderRequests.Navigation({ routeTree })),
    refresh: (routeTree) => publish(renderRequests.ServerFunction({ routeTree })),
  });
};
