import { describe, expect, test } from "@effect/vitest";
import { Context, Effect, Layer } from "effect";

import { getApplicationState } from "#core/application/definition.tsx";
import { Application } from "#core/application/effront.ts";
import { getRoutesState } from "#core/application/routes.ts";
import {
  applicationRoutes,
  EFFRONT,
  findDestination,
  HomePage,
  RootLayout,
  SaturdayPage,
  ScheduleLayout,
} from "./definition-render.fixture.tsx";

type LayoutKey = "effront/tests/application/LayoutService";
type PageKey = "effront/tests/application/PageService";
type NestedPageKey = "effront/tests/application/NestedPageService";
type AppServices = LayoutKey | PageKey | NestedPageKey;

const LayoutService = Context.Service<LayoutKey, object>("effront/tests/application/LayoutService");
const PageService = Context.Service<PageKey, object>("effront/tests/application/PageService");
const NestedPageService = Context.Service<NestedPageKey, object>(
  "effront/tests/application/NestedPageService",
);

describe("inherited middleware", () => {
  test("compiles inherited middleware without adding React scopes", () => {
    const RootMiddleware = EFFRONT.Middleware.make((httpEffect) => httpEffect);
    const NestedMiddleware = EFFRONT.Middleware.make((httpEffect) => httpEffect);
    const RootScope = EFFRONT.withMiddleware(RootMiddleware);
    const NestedScope = RootScope.withMiddleware(NestedMiddleware);
    const App = EFFRONT.make({
      routes: RootScope.Routes.make({ layout: RootLayout })
        .page("/", HomePage)
        .mount("/schedule", NestedScope.Routes.make().page("/", SaturdayPage)),
    });
    const destinations = applicationRoutes(App);
    const home = findDestination(destinations, "/");
    const nested = findDestination(destinations, "/schedule");
    expect({
      frozen: Object.isFrozen(nested.middleware),
      home: home.middleware,
      nested: nested.middleware,
      scopes: nested.scopes.length,
    }).toStrictEqual({
      frozen: true,
      home: [RootMiddleware],
      nested: [RootMiddleware, NestedMiddleware],
      scopes: 1,
    });
  });

  test("does not duplicate inherited middleware across nested scopes", () => {
    const RequireUser = EFFRONT.Middleware.make((httpEffect) => httpEffect);
    const Authenticated = EFFRONT.withMiddleware(RequireUser);
    const routes = Authenticated.Routes.make({ layout: RootLayout }).mount(
      "/account",
      Authenticated.Routes.make().page("/", HomePage),
    );
    const App = EFFRONT.make({ routes });

    expect(findDestination(applicationRoutes(App), "/account").middleware).toStrictEqual([
      RequireUser,
    ]);
  });
});

describe("middleware chain and route scope identity", () => {
  test("rejects repeated middleware in a divergent mounted scope without Pages", () => {
    const Shared = EFFRONT.Middleware.make((httpEffect) => httpEffect);
    const NestedOnly = EFFRONT.Middleware.make((httpEffect) => httpEffect);
    const ParentEFFRONT = EFFRONT.withMiddleware(Shared);
    const DivergentEFFRONT = EFFRONT.withMiddleware(NestedOnly).withMiddleware(Shared);
    const leafRoutes = EFFRONT.Routes.make().page("/", HomePage);
    const divergentRoutes = DivergentEFFRONT.Routes.make().mount("/leaf", leafRoutes);
    const routes = ParentEFFRONT.Routes.make({ layout: RootLayout }).mount(
      "/nested",
      divergentRoutes,
    );

    expect(() => EFFRONT.make({ routes })).toThrow(
      expect.objectContaining({
        message:
          'Middleware beneath route prefix "/nested" appears more than once in its resolved chain.',
        name: "TypeError",
      }),
    );
  });

  test("allocates route scope IDs across derived EFFRONT views", () => {
    const Middleware = EFFRONT.Middleware.make((httpEffect) => httpEffect);
    const ScopedEFFRONT = EFFRONT.withMiddleware(Middleware);
    const rootRoutes = EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage);
    const scopedRoutes = ScopedEFFRONT.Routes.make({ layout: ScheduleLayout }).page(
      "/",
      SaturdayPage,
    );

    expect(getRoutesState(rootRoutes).scopeId).not.toBe(getRoutesState(scopedRoutes).scopeId);
  });
});

describe("application layer and service contracts", () => {
  test("declares service contracts once and chooses their implementations at application assembly", () => {
    const ServiceEFFRONT = Application.effront<AppServices>();
    const ServiceLayout = ServiceEFFRONT.Layout.make({
      render: Effect.fn(function* ({ children }) {
        yield* LayoutService;
        return children;
      }),
    });
    const ServicePage = ServiceEFFRONT.Page.make({
      render: Effect.fn(function* () {
        yield* PageService;
        return <h1>Home</h1>;
      }),
    });
    const ServiceNestedPage = ServiceEFFRONT.Page.make({
      render: Effect.fn(function* () {
        yield* NestedPageService;
        return <h1>Nested</h1>;
      }),
    });
    const ApplicationLayer = Layer.mergeAll(
      Layer.succeed(LayoutService, LayoutService.of({})),
      Layer.succeed(PageService, PageService.of({})),
      Layer.succeed(NestedPageService, NestedPageService.of({})),
    );
    const App = ServiceEFFRONT.make({
      layer: ApplicationLayer,
      routes: ServiceEFFRONT.Routes.make({ layout: ServiceLayout })
        .page("/", ServicePage)
        .mount("/nested", ServiceEFFRONT.Routes.make().page("/", ServiceNestedPage)),
    });
    expect(getApplicationState(App).layer).toBe(ApplicationLayer);
  });
});
