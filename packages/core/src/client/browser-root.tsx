import { useLayoutEffect, useState } from "react";
import type { ReactElement } from "react";

import type { RouteTreeModel } from "#core/rsc/route-tree.ts";
import { BrowserErrorBoundary } from "./browser-error-boundary.tsx";
import type { BrowserRenderObservers } from "./browser-error-boundary.tsx";
import { isDiscard, renders } from "./browser-renderer-model.ts";
import type { BrowserRender } from "./browser-renderer-model.ts";
import type { BrowserRenderer } from "./browser-renderer.ts";
import { RouteTree } from "./route-tree.tsx";

type BrowserRootProps = BrowserRenderObservers &
  Readonly<{
    initialTree: RouteTreeModel;
    initialize: () => void;
    renderer: typeof BrowserRenderer.Service;
  }>;

// oxlint-disable-next-line eslint/func-style -- The shared React rule requires a declaration for named components.
export function BrowserRoot({
  initialTree,
  initialize,
  onError,
  onRendered,
  renderer,
}: BrowserRootProps): ReactElement {
  const [render, setRender] = useState<BrowserRender>(() =>
    renders.Initial({ routeTree: initialTree }),
  );

  useLayoutEffect(() => {
    renderer.initialize(initialTree, setRender);
    initialize();
  }, [initialTree, initialize, renderer]);

  useLayoutEffect(() => {
    renderer.commit(render);
  }, [render, renderer]);

  const routeTree = isDiscard(render) ? render.restore.routeTree : render.routeTree;
  return (
    <BrowserErrorBoundary onError={onError} onRendered={onRendered} render={render}>
      <RouteTree root={routeTree} />
    </BrowserErrorBoundary>
  );
}
