import { Array, Predicate } from "effect";
import { Suspense } from "react";

import type { LayoutComponent } from "#core/application/layout.ts";
import type { LoadingComponent } from "#core/application/loading.ts";
import type { PageParams } from "#core/application/page.ts";
import type { CompiledDestination, RouteScope } from "#core/application/route-graph.ts";
import type { AbsolutePath } from "#core/application/route-path.ts";
import { RouteOutlet } from "#core/client/route-outlet.tsx";
import type { RouteTreeModel } from "./route-tree.ts";

type RenderRouteTreeOptions<Services> = Readonly<{
  destination: CompiledDestination<Services>;
  params: PageParams;
  pathname: AbsolutePath;
}>;

// oxlint-disable-next-line unicorn/no-null -- The Flight route-tree model uses null for the leaf's absent child.
const noChild = null;

const wrapInLoading = <Services,>(
  child: RouteTreeModel,
  Loading: LoadingComponent<Services>,
  id: string,
): RouteTreeModel => ({
  child,
  content: (
    <Suspense
      // oxlint-disable-next-line react-perf/jsx-no-jsx-as-prop -- The server creates the fallback for this route boundary when it emits the tree.
      fallback={<Loading />}
    >
      <RouteOutlet />
    </Suspense>
  ),
  id,
});

const wrapInLayout = <Services,>(
  child: RouteTreeModel,
  Layout: LayoutComponent<Services>,
  id: string,
): RouteTreeModel => ({
  child,
  content: (
    <Layout>
      <RouteOutlet />
    </Layout>
  ),
  id,
});

const wrapInRouteScope = <Services,>(
  child: RouteTreeModel,
  { id, layout, loading }: RouteScope<Services>,
  pathname: AbsolutePath,
): RouteTreeModel => {
  const withLoading = Predicate.isNullish(loading)
    ? child
    : wrapInLoading(child, loading, `loading:${id}:${pathname}`);
  return Predicate.isNullish(layout)
    ? withLoading
    : wrapInLayout(withLoading, layout, `layout:${id}`);
};

export const renderRouteTree = <Services,>({
  destination,
  params,
  pathname,
}: RenderRouteTreeOptions<Services>): RouteTreeModel => {
  const { boundary: PageBoundary, component: Page } = destination.page;
  const page: RouteTreeModel = {
    child: noChild,
    content: (
      <PageBoundary>
        <Page params={params} />
      </PageBoundary>
    ),
    id: `page:${pathname}`,
  };
  return Array.reduceRight(destination.scopes, page, (child, scope) =>
    wrapInRouteScope(child, scope, pathname),
  );
};
