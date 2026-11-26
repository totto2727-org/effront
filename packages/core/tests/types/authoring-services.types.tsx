import { Context, Effect, Layer, Option, Schema } from "effect";
import { expectTypeOf } from "vite-plus/test";

import type { ApplicationServices } from "#core/application/definition.tsx";
import { Application } from "#core/application/effront.ts";

type LayoutServiceKey = "effront/tests/types/LayoutService";
const LayoutService = Context.Service<LayoutServiceKey, object>(
  "effront/tests/types/LayoutService",
);
type PageServiceKey = "effront/tests/types/PageService";
const PageService = Context.Service<PageServiceKey, object>("effront/tests/types/PageService");
type NestedPageServiceKey = "effront/tests/types/NestedPageService";
const NestedPageService = Context.Service<NestedPageServiceKey, object>(
  "effront/tests/types/NestedPageService",
);
type LayerDependencyKey = "effront/tests/types/LayerDependency";
const LayerDependency = Context.Service<LayerDependencyKey, object>(
  "effront/tests/types/LayerDependency",
);

// oxlint-disable-next-line unicorn/no-null -- These type fixtures model an intentionally empty React payload.
const emptyContent = null;

const EFFRONT = Application.effront();
const RootLayout = EFFRONT.Layout.make({ render: ({ children }) => Effect.succeed(children) });
const HomePage = EFFRONT.Page.make({ render: () => Effect.succeed(<h1>Home</h1>) });

const ServiceEFFRONT = Application.effront<PageServiceKey>();
const ServiceRootLayout = ServiceEFFRONT.Layout.make({
  render: ({ children }) => Effect.succeed(children),
});
const ServicePage = ServiceEFFRONT.Page.make({
  render: Effect.fnUntraced(function* () {
    yield* PageService;
    return emptyContent;
  }),
});
const serviceRoutes = ServiceEFFRONT.Routes.make({ layout: ServiceRootLayout }).page(
  "/",
  ServicePage,
);
const incompleteLayer = Layer.effect(PageService, Effect.as(LayerDependency, PageService.of({})));
EFFRONT.make({
  // @ts-expect-error The application root must define a Layout.
  routes: EFFRONT.Routes.make().page("/", HomePage),
});
EFFRONT.make({
  // @ts-expect-error The application must contain at least one reachable Page.
  routes: EFFRONT.Routes.make({ layout: RootLayout }),
});
// @ts-expect-error The declared service universe requires an implementation Layer.
ServiceEFFRONT.make({ routes: serviceRoutes });
ServiceEFFRONT.make({
  // @ts-expect-error Required authoring services must be provided by the application layer.
  layer: Layer.empty,
  routes: serviceRoutes,
});
ServiceEFFRONT.make({
  // External inputs remain requirements of the native HTTP effect.
  layer: incompleteLayer,
  routes: serviceRoutes,
});

const NarrowEFFRONT = Application.effront<PageServiceKey>();
const ServiceSchema = Schema.String.pipe(
  Schema.catchDecodingWithContext(() => Effect.map(LayoutService, () => Option.some("fallback"))),
);
const layoutServicePageOptions = {
  render: Effect.fnUntraced(function* () {
    yield* LayoutService;
    return emptyContent;
  }),
};
// @ts-expect-error LayoutService is not part of this application's declared contracts.
NarrowEFFRONT.Page.make(layoutServicePageOptions);
const ProvideLayoutService = NarrowEFFRONT.Middleware.make<{ provides: LayoutServiceKey }>(
  (httpEffect) => httpEffect.pipe(Effect.provideService(LayoutService, LayoutService.of({}))),
);
const LayoutServiceEFFRONT = NarrowEFFRONT.withMiddleware(ProvideLayoutService);
LayoutServiceEFFRONT.Page.make(layoutServicePageOptions);
const ProvideLayoutDependencies = NarrowEFFRONT.Middleware.make<{
  provides: LayoutServiceKey | LayerDependencyKey;
}>((httpEffect) =>
  httpEffect.pipe(
    Effect.provideService(LayoutService, LayoutService.of({})),
    Effect.provideService(LayerDependency, LayerDependency.of({})),
  ),
);
const LayoutDependenciesEFFRONT = NarrowEFFRONT.withMiddleware(ProvideLayoutDependencies);
LayoutDependenciesEFFRONT.Page.make({
  render: Effect.fnUntraced(function* () {
    yield* LayoutService;
    yield* LayerDependency;
    return emptyContent;
  }),
});
NarrowEFFRONT.Middleware.make<{ provides: LayoutServiceKey }>(
  // @ts-expect-error A middleware must provide every service declared in `provides`.
  // Intentional invalid middleware fixture
  (httpEffect) => httpEffect,
);
const RequiresLayoutService = LayoutServiceEFFRONT.Middleware.make((httpEffect) =>
  Effect.andThen(LayoutService, httpEffect),
);
LayoutServiceEFFRONT.withMiddleware(RequiresLayoutService);
// @ts-expect-error Middleware requirements must already be available in the current scope.
NarrowEFFRONT.withMiddleware(RequiresLayoutService);
NarrowEFFRONT.Middleware.make((httpEffect) =>
  // @ts-expect-error LayoutService is not available to this middleware.
  // Intentional invalid Effect fixture
  Effect.gen(function* () {
    yield* LayoutService;
    return yield* httpEffect;
  }),
);
NarrowEFFRONT.Layout.make({
  // @ts-expect-error LayoutService is not part of this application's declared contracts.
  // Intentional invalid Effect fixture
  render: Effect.fnUntraced(function* ({ children }) {
    yield* LayoutService;
    return children;
  }),
});
NarrowEFFRONT.Component.make({
  // @ts-expect-error LayoutService is not part of this application's declared contracts.
  // Intentional invalid Effect fixture
  render: Effect.fnUntraced(function* () {
    yield* LayoutService;
    return emptyContent;
  }),
});
NarrowEFFRONT.ServerFn.make({
  // @ts-expect-error LayoutService is not part of this application's declared contracts.
  // Intentional invalid Effect fixture
  handler: Effect.fnUntraced(function* () {
    yield* LayoutService;
    return emptyContent;
  }),
  input: Schema.String,
});
NarrowEFFRONT.ServerFn.make({
  handler: () => Effect.void,
  // @ts-expect-error LayoutService required by Schema decoding is outside this EFFRONT universe.
  input: ServiceSchema,
});
const serviceSchemaPageOptions = {
  params: Schema.Struct({ value: ServiceSchema }),
  render: () => Effect.succeed(emptyContent),
};
// @ts-expect-error LayoutService required by param decoding is outside this EFFRONT universe.
NarrowEFFRONT.Page.make(serviceSchemaPageOptions);

const WideEFFRONT = Application.effront<PageServiceKey | LayoutServiceKey>();
const NarrowPage = NarrowEFFRONT.Page.make({ render: () => Effect.succeed(emptyContent) });
// @ts-expect-error An EFFRONT member belongs to one exact service universe.
WideEFFRONT.Routes.make().page("/", NarrowPage);

const ServiceUniverseEFFRONT = Application.effront<
  LayoutServiceKey | PageServiceKey | NestedPageServiceKey
>();
const ServiceUniverseLayout = ServiceUniverseEFFRONT.Layout.make({
  render: ({ children }) => Effect.succeed(children),
});
const ServiceUniversePage = ServiceUniverseEFFRONT.Page.make({
  render: () => Effect.succeed(emptyContent),
});
const layoutLayer = Layer.succeed(LayoutService, LayoutService.of({}));
const pageLayer = Layer.succeed(PageService, PageService.of({}));
const nestedPageLayer = Layer.succeed(NestedPageService, NestedPageService.of({}));
const ServiceUniverseApp = ServiceUniverseEFFRONT.make({
  layer: Layer.mergeAll(layoutLayer, pageLayer, nestedPageLayer),
  routes: ServiceUniverseEFFRONT.Routes.make({ layout: ServiceUniverseLayout }).page(
    "/",
    ServiceUniversePage,
  ),
});
type Services = ApplicationServices<typeof ServiceUniverseApp>;
const servicesAreExact: [Services] extends [
  LayoutServiceKey | PageServiceKey | NestedPageServiceKey,
]
  ? [LayoutServiceKey | PageServiceKey | NestedPageServiceKey] extends [Services]
    ? true
    : false
  : false = true;
expectTypeOf(servicesAreExact);
