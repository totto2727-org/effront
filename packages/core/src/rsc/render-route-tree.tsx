import { Suspense } from "react";

import type { PageParams } from "#core/application/page.ts";
import type { CompiledDestination } from "#core/application/route-graph.ts";
import type { AbsolutePath } from "#core/application/route-path.ts";
import { RouteOutlet } from "#core/client/route-tree.tsx";
import type { RouteTreeModel } from "./route-tree.ts";

type RenderRouteTreeOptions<Services> = Readonly<{
  destination: CompiledDestination<Services>;
  pathname: AbsolutePath;
  params: PageParams;
}>;

export const renderRouteTree = <Services,>({
  destination,
  pathname,
  params,
}: RenderRouteTreeOptions<Services>): RouteTreeModel => {
  const Page = destination.page.component;
  const PageBoundary = destination.page.boundary;
  let tree: RouteTreeModel = {
    child: null,
    content: (
      <PageBoundary>
        <Page params={params} />
      </PageBoundary>
    ),
    id: `page:${pathname}`,
  };

  for (let index = destination.scopes.length - 1; index >= 0; index--) {
    const scope = destination.scopes[index];
    if (scope === undefined) {
      continue;
    }

    if (scope.loading !== null) {
      const Loading = scope.loading;
      tree = {
        child: tree,
        content: (
          <Suspense fallback={<Loading />}>
            <RouteOutlet />
          </Suspense>
        ),
        id: `loading:${scope.id}:${pathname}`,
      };
    }

    if (scope.layout !== null) {
      const Layout = scope.layout;
      tree = {
        child: tree,
        content: (
          <Layout>
            <RouteOutlet />
          </Layout>
        ),
        id: `layout:${scope.id}`,
      };
    }
  }

  return tree;
};
