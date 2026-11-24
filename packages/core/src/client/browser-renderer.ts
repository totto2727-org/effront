import { Context, Effect, Iterable, Layer, MutableRef, Option, Predicate } from "effect";

import type { RouteTreeModel } from "#core/rsc/route-tree.ts";

import { isDiscard, isInitial, nextRouteRender, renders } from "./browser-renderer-model.ts";
import type {
  BrowserRender,
  BrowserRendererNavigation,
  ReadyRenderer,
  RendererReadiness,
  RouteRender,
  VisibleRender,
} from "./browser-renderer-model.ts";

export type { BrowserRender, BrowserRendererNavigation } from "./browser-renderer-model.ts";

const firstPublicationOrder = 0;

const invariantError = (message: string): TypeError =>
  // oxlint-disable-next-line rules/require-tagged-error -- Preserve the native TypeError for browser renderer protocol violations.
  new TypeError(message);

const getReady = (state: RendererReadiness): ReadyRenderer => {
  const current = MutableRef.get(state);
  if (Option.isNone(current)) {
    throw invariantError("BrowserRenderer must be initialized by ReactDOMRenderer.");
  }
  return current.value;
};

const initializeRenderer = (
  state: RendererReadiness,
  routeTree: RouteTreeModel,
  publish: ReadyRenderer["publish"],
): void => {
  const current = MutableRef.get(state);
  if (Option.isSome(current)) {
    if (current.value.publish === publish) {
      return;
    }
    throw invariantError("BrowserRenderer cannot be initialized by more than one React root.");
  }

  const ready = {
    current: MutableRef.make<BrowserRender>(renders.Initial({ routeTree })),
    liveRenders: new Map(),
    publicationOrder: MutableRef.make(firstPublicationOrder),
    publish,
  };
  MutableRef.set(state, Option.some(ready));
};

const visibleRender = (render: BrowserRender): VisibleRender =>
  isDiscard(render) ? render.restore : render;

const publish = (
  ready: ReadyRenderer,
  publications: WeakSet<BrowserRender>,
  render: BrowserRender,
): void => {
  publications.add(render);
  ready.publish(render);
};

const markRestored = (ready: ReadyRenderer, restore: VisibleRender, order: number): void => {
  if (!isInitial(restore)) {
    // Reinsertion keeps the map ordered by each tree's latest publication.
    ready.liveRenders.delete(restore);
    ready.liveRenders.set(restore, { lastPublicationOrder: order, phase: "Committed" });
  }
};

const discard = (
  ready: ReadyRenderer,
  publications: WeakSet<BrowserRender>,
  render: RouteRender,
): void => {
  // Cancellation can arrive before the caller observes commit or retirement.
  if (ready.liveRenders.get(render)?.phase !== "Scheduled") {
    return;
  }
  ready.liveRenders.set(render, { lastPublicationOrder: render.order, phase: "DiscardRequested" });
  const restore = visibleRender(MutableRef.get(ready.current));
  const order = MutableRef.incrementAndGet(ready.publicationOrder);
  markRestored(ready, restore, order);
  publish(ready, publications, renders.Discard({ order, restore }));
};

const schedule = (
  ready: ReadyRenderer,
  publications: WeakSet<BrowserRender>,
  request: Readonly<{ kind: "Navigation" | "Refresh"; routeTree: RouteTreeModel }>,
): BrowserRendererNavigation => {
  const order = MutableRef.incrementAndGet(ready.publicationOrder);
  const render = nextRouteRender(request.kind, request.routeTree, order);
  ready.liveRenders.set(render, { lastPublicationOrder: order, phase: "Scheduled" });
  publish(ready, publications, render);

  return {
    committed: render.committed.promise,
    // oxlint-disable-next-line typescript/promise-function-async -- All discard calls must return the original retirement promise.
    discard: () => {
      discard(ready, publications, render);
      return render.retired.promise;
    },
    retired: render.retired.promise,
  };
};

const markCommitted = (ready: ReadyRenderer, visible: VisibleRender): void => {
  if (isInitial(visible)) {
    return;
  }
  const live = ready.liveRenders.get(visible);
  if (Predicate.isNullish(live)) {
    throw invariantError("A retired browser tree cannot commit.");
  }
  ready.liveRenders.set(visible, { ...live, phase: "Committed" });
};

const retireSuperseded = (ready: ReadyRenderer, visible: VisibleRender, order: number): void => {
  const earlier = Iterable.takeWhile(
    ready.liveRenders,
    ([, live]) => live.lastPublicationOrder <= order,
  );
  Iterable.forEach(earlier, ([retained]) => {
    if (retained !== visible) {
      ready.liveRenders.delete(retained);
      retained.retired.resolve();
    }
  });
};

const validatePublication = (
  ready: ReadyRenderer,
  publications: WeakSet<BrowserRender>,
  render: Exclude<BrowserRender, ReturnType<typeof renders.Initial>>,
): void => {
  if (!publications.has(render)) {
    throw invariantError("Browser render does not belong to this root.");
  }
  const current = MutableRef.get(ready.current);
  if (!isInitial(current) && render.order < current.order) {
    throw invariantError("Browser renders must commit in publication order.");
  }
};

const commitRender = (
  ready: ReadyRenderer,
  publications: WeakSet<BrowserRender>,
  render: BrowserRender,
): void => {
  if (isInitial(render)) {
    return;
  }
  validatePublication(ready, publications, render);
  const visible = visibleRender(render);
  markCommitted(ready, visible);
  MutableRef.set(ready.current, render);
  if (!isDiscard(render)) {
    render.committed.resolve();
  }
  // A retained tree stays alive while visible or referenced by a pending discard.
  retireSuperseded(ready, visible, render.order);
};

const makeBrowserRenderer = Effect.sync(() => {
  const state = MutableRef.make(Option.none<ReadyRenderer>());
  const publications = new WeakSet<BrowserRender>();
  return {
    commit: (render: BrowserRender): void => {
      commitRender(getReady(state), publications, render);
    },
    initialize: (initial: RouteTreeModel, publishRender: ReadyRenderer["publish"]): void => {
      initializeRenderer(state, initial, publishRender);
    },
    navigate: (routeTree: RouteTreeModel): BrowserRendererNavigation =>
      schedule(getReady(state), publications, { kind: "Navigation", routeTree }),
    refresh: (routeTree: RouteTreeModel): BrowserRendererNavigation =>
      schedule(getReady(state), publications, { kind: "Refresh", routeTree }),
  };
});

export class BrowserRenderer extends Context.Service<BrowserRenderer>()(
  "effront/client/BrowserRenderer",
  { make: makeBrowserRenderer },
) {
  // oxlint-disable-next-line rules/no-readonly -- Keep the public layer reference fixed for this service.
  public static readonly layer = Layer.effect(this, this.make);

  // oxlint-disable-next-line rules/no-readonly -- Keep the reference to the public testing layer fixed.
  public static readonly layerTest = Layer.mock(this);
}
