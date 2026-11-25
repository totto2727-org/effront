import { assert } from "@effect/vitest";
import { Effect, Predicate } from "effect";
import type { ReactElement, ReactNode } from "react";
import { isValidElement } from "react";

import type { ApplicationDefinition } from "#core/application/definition.tsx";
import { getApplicationState } from "#core/application/definition.tsx";
import { Application } from "#core/application/effront.ts";
import type {
  AnyPageDefinition,
  EncodedPageParams,
  PageComponent,
  PageRuntimeProps,
} from "#core/application/page.ts";
import { getPageState, pageParams } from "#core/application/page.ts";
import type { CompiledDestination } from "#core/application/route-graph.ts";
import type { AbsolutePath } from "#core/application/route-path.ts";
import { renderRouteTree } from "#core/rsc/render-route-tree.tsx";
import type { RouteTreeModel } from "#core/rsc/route-tree.ts";

export const asElement = <Props,>(node: ReactNode): ReactElement<Props> => {
  assert(isValidElement<Props>(node), "Expected a React element.");
  return node;
};

export const pageContent = (node: RouteTreeModel): ReactElement<PageRuntimeProps> => {
  const outlet = asElement<Readonly<{ children: ReactNode }>>(node.content);
  return asElement<PageRuntimeProps>(outlet.props.children);
};

export const requiredChild = (node: RouteTreeModel): RouteTreeModel => {
  assert(
    Predicate.isNotNullish(node.child),
    `Expected route node "${node.id}" to contain a child.`,
  );
  return node.child;
};

export const findDestination = <Services,>(
  routes: Readonly<CompiledDestination<Services>[]>,
  pattern: AbsolutePath,
): CompiledDestination<Services> => {
  const destination = routes.find((route) => route.pattern === pattern);
  assert(Predicate.isNotNullish(destination), `Expected a compiled destination for "${pattern}".`);
  return destination;
};

type RequestPath = Readonly<{
  params?: EncodedPageParams;
  pathname?: AbsolutePath;
}>;

export const renderApplicationRoute = <Services,>(
  routes: Readonly<CompiledDestination<Services>[]>,
  pattern: AbsolutePath,
  { params = {}, pathname = pattern }: RequestPath = {},
): RouteTreeModel =>
  renderRouteTree({
    destination: findDestination(routes, pattern),
    params: pageParams.Encoded({ value: params }),
    pathname,
  });

export const applicationRoutes = <Services, ApplicationError>(
  application: ApplicationDefinition<Services, ApplicationError>,
): Readonly<CompiledDestination<Services>[]> => getApplicationState(application).routes;

export const pageComponent = <Services,>(page: AnyPageDefinition<Services>): PageComponent =>
  getPageState(page).component;

export const EFFRONT = Application.effront();

export const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="en">
        <body>{children}</body>
      </html>,
    ),
});
export const ScheduleLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <section>
        <aside>Schedule navigation</aside>
        {children}
      </section>,
    ),
});
export const ScheduleLoading = EFFRONT.Loading.make({ render: () => <p>Loading schedule...</p> });
export const HomePage = EFFRONT.Page.make({ render: () => Effect.succeed(<h1>Home</h1>) });
export const SaturdayPage = EFFRONT.Page.make({ render: () => Effect.succeed(<h1>Saturday</h1>) });
export const SundayPage = EFFRONT.Page.make({ render: () => Effect.succeed(<h1>Sunday</h1>) });
