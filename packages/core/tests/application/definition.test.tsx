import { describe, expect, test } from "@effect/vitest";
import { Effect, Schema } from "effect";
import type { ReactNode } from "react";
import { Suspense } from "react";

import { pageParams } from "#core/application/page.ts";
import { RouteOutlet } from "#core/client/route-outlet.tsx";
import type { RouteTreeModel } from "#core/rsc/route-tree.ts";
import {
  applicationRoutes,
  asElement,
  EFFRONT,
  findDestination,
  HomePage,
  pageComponent,
  pageContent,
  renderApplicationRoute,
  requiredChild,
  RootLayout,
  SaturdayPage,
  ScheduleLayout,
  ScheduleLoading,
  SundayPage,
} from "./definition-render.fixture.tsx";

type ScheduledNodes = Readonly<{
  layout: RouteTreeModel;
  loading: RouteTreeModel;
  root: RouteTreeModel;
}>;

const scheduledNodes = (root: RouteTreeModel): ScheduledNodes => {
  const layout = requiredChild(root);
  return { layout, loading: requiredChild(layout), root };
};

describe("root layout", () => {
  test("renders a root Layout around its exact Page", () => {
    const App = EFFRONT.make({
      routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage),
    });
    const rootNode = renderApplicationRoute(applicationRoutes(App), "/");
    const root = asElement<Readonly<{ children: ReactNode }>>(rootNode.content);
    const pageNode = requiredChild(rootNode);

    expect(rootNode.id).not.toBe(pageNode.id);
    expect({
      layout: root.type,
      outlet: asElement(root.props.children).type,
      page: pageContent(pageNode).type,
    }).toStrictEqual({ layout: RootLayout, outlet: RouteOutlet, page: pageComponent(HomePage) });
    expect(applicationRoutes(App).map(({ pattern }) => pattern)).toStrictEqual(["/"]);
    expect({
      descriptor: Object.getOwnPropertyDescriptor(App, "routes"),
      extensible: Object.isExtensible(App),
    }).toMatchObject({ descriptor: { configurable: false, writable: false }, extensible: true });
  });
});

describe("dynamic destination parameters", () => {
  test("renders a dynamic route pattern with its concrete pathname and captured params", () => {
    const DayPage = EFFRONT.Page.make({
      params: Schema.Struct({ day: Schema.Literals(["saturday", "sunday"]) }),
      render: ({ params }) => Effect.succeed(<h1>{params.day}</h1>),
    });
    const App = EFFRONT.make({
      routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/schedule/:day", DayPage),
    });
    const saturdayPage = requiredChild(
      renderApplicationRoute(applicationRoutes(App), "/schedule/:day", {
        params: { day: "saturday" },
        pathname: "/schedule/saturday",
      }),
    );
    const sundayPage = requiredChild(
      renderApplicationRoute(applicationRoutes(App), "/schedule/:day", {
        params: { day: "sunday" },
        pathname: "/schedule/sunday",
      }),
    );
    const saturdayElement = pageContent(saturdayPage);

    expect(applicationRoutes(App).map(({ pattern }) => pattern)).toStrictEqual(["/schedule/:day"]);
    expect(saturdayPage.id).not.toBe(sundayPage.id);
    expect(saturdayElement.type).toBe(pageComponent(DayPage));
    expect(saturdayElement.props.params).toStrictEqual(
      pageParams.Encoded({ value: { day: "saturday" } }),
    );
  });
});

describe("loading beneath its owning layout", () => {
  test("preserves Layout ancestry and places Loading below its owning Layout", () => {
    const scheduleRoutes = EFFRONT.Routes.make({
      layout: ScheduleLayout,
      loading: ScheduleLoading,
    })
      .page("/", SaturdayPage)
      .page("/day-two", SundayPage);
    const App = EFFRONT.make({
      routes: EFFRONT.Routes.make({ layout: RootLayout })
        .page("/", HomePage)
        .mount("/schedule", scheduleRoutes),
    });
    const destinations = applicationRoutes(App);
    const sunday = scheduledNodes(renderApplicationRoute(destinations, "/schedule/day-two"));
    const saturday = scheduledNodes(renderApplicationRoute(destinations, "/schedule"));
    const page = requiredChild(sunday.loading);
    const boundary = asElement<Readonly<{ children: ReactNode; fallback: ReactNode }>>(
      sunday.loading.content,
    );
    expect(destinations.map(({ pattern }) => pattern)).toStrictEqual([
      "/",
      "/schedule",
      "/schedule/day-two",
    ]);
    expect({
      distinctLoading: sunday.loading.id !== saturday.loading.id,
      distinctPage: page.id !== sunday.loading.id,
      sharedLayout: sunday.layout.id === saturday.layout.id,
    }).toStrictEqual({ distinctLoading: true, distinctPage: true, sharedLayout: true });
    expect({
      boundary: boundary.type,
      fallback: asElement(boundary.props.fallback).type,
      layout: asElement(sunday.layout.content).type,
      outlet: asElement(boundary.props.children).type,
      page: pageContent(page).type,
      root: asElement(sunday.root.content).type,
    }).toStrictEqual({
      boundary: Suspense,
      fallback: ScheduleLoading,
      layout: ScheduleLayout,
      outlet: RouteOutlet,
      page: pageComponent(SundayPage),
      root: RootLayout,
    });
  });
});

describe("route groups without nested layouts", () => {
  test("lets layoutless Routes group paths without adding a rendered node", () => {
    const groupedRoutes = EFFRONT.Routes.make()
      .page("/", SaturdayPage)
      .page("/day-two", SundayPage);
    const App = EFFRONT.make({
      routes: EFFRONT.Routes.make({ layout: RootLayout }).mount("/schedule", groupedRoutes),
    });
    const rootNode = renderApplicationRoute(applicationRoutes(App), "/schedule/day-two");
    const pageNode = requiredChild(rootNode);

    expect(pageContent(pageNode).type).toBe(pageComponent(SundayPage));
  });

  test("supports a Loading scope without requiring a nested Layout", () => {
    const groupedRoutes = EFFRONT.Routes.make({ loading: ScheduleLoading }).page("/", SaturdayPage);
    const App = EFFRONT.make({
      routes: EFFRONT.Routes.make({ layout: RootLayout }).mount("/schedule", groupedRoutes),
    });
    const rootNode = renderApplicationRoute(applicationRoutes(App), "/schedule");
    const loadingNode = requiredChild(rootNode);
    const pageNode = requiredChild(loadingNode);

    expect(asElement(loadingNode.content).type).toBe(Suspense);
    expect(pageContent(pageNode).type).toBe(pageComponent(SaturdayPage));
  });
});

describe("repeated route mounts and native destinations", () => {
  test("compiles one Routes value mounted at more than one prefix", () => {
    const sharedRoutes = EFFRONT.Routes.make({ layout: ScheduleLayout })
      .page("/", SaturdayPage)
      .page("/day-two", SundayPage);
    const App = EFFRONT.make({
      routes: EFFRONT.Routes.make({ layout: RootLayout })
        .page("/", HomePage)
        .mount("/saturday", sharedRoutes)
        .mount("/sunday", sharedRoutes),
    });
    const saturdayLayoutNode = requiredChild(
      renderApplicationRoute(applicationRoutes(App), "/saturday/day-two"),
    );
    const sundayLayoutNode = requiredChild(
      renderApplicationRoute(applicationRoutes(App), "/sunday/day-two"),
    );

    expect(applicationRoutes(App).map(({ pattern }) => pattern)).toStrictEqual([
      "/",
      "/saturday",
      "/saturday/day-two",
      "/sunday",
      "/sunday/day-two",
    ]);
    expect(saturdayLayoutNode.id).not.toBe(sundayLayoutNode.id);
    expect(requiredChild(saturdayLayoutNode).id).not.toBe(requiredChild(sundayLayoutNode).id);
  });

  test("compiles Pages into matcher-neutral destinations", () => {
    const App = EFFRONT.make({
      routes: EFFRONT.Routes.make({ layout: RootLayout })
        .page("/", HomePage)
        .mount("/schedule", EFFRONT.Routes.make().page("/", SaturdayPage)),
    });

    expect(applicationRoutes(App).map(({ pattern }) => pattern)).toStrictEqual(["/", "/schedule"]);
    const destinations = applicationRoutes(App);
    expect(findDestination(destinations, "/").page.component).toBe(pageComponent(HomePage));
    expect(findDestination(destinations, "/schedule").page.component).toBe(
      pageComponent(SaturdayPage),
    );
  });
});
