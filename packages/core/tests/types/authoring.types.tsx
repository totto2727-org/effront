import { Effect, Schema, SchemaTransformation } from "effect";
import type { ReactNode } from "react";
import { expectTypeOf } from "vite-plus/test";

import { Application } from "#core/application/effront.ts";
import type { AnyPageDefinition } from "#core/application/page.ts";
import type { AbsolutePath } from "#core/application/route-path.ts";
import type { AnyRoutes, RoutesDefinition, RoutesPaths } from "#core/application/routes.ts";

// oxlint-disable-next-line unicorn/no-null -- These type fixtures model an intentionally empty React payload.
const emptyContent = null;

const EFFRONT = Application.effront();
const RootLayout = EFFRONT.Layout.make({ render: ({ children }) => Effect.succeed(children) });
EFFRONT.Layout.make({
  render: ({ children }) => {
    const inferredChildren: ReactNode = children;
    expectTypeOf(children).not.toBeAny();
    return Effect.succeed(inferredChildren);
  },
});
const Loading = EFFRONT.Loading.make({ render: () => <p>Loading...</p> });
expectTypeOf(Loading);
const HomePage = EFFRONT.Page.make({ render: () => Effect.succeed(<h1>Home</h1>) });
const HistoryPage = EFFRONT.Page.make({ render: () => Effect.succeed(<h1>History</h1>) });
const DayPage = EFFRONT.Page.make({
  params: Schema.Struct({ day: Schema.Literals(["saturday", "sunday"]) }),
  render: ({ params }) => Effect.succeed(<h1>{params.day}</h1>),
});
const SlugPage = EFFRONT.Page.make({
  params: Schema.Struct({ slug: Schema.String }),
  render: ({ params }) => Effect.succeed(<h1>{params.slug}</h1>),
});
const NestedParamsPage = EFFRONT.Page.make({
  params: Schema.Struct({ b: Schema.String, d: Schema.String }),
  render: ({ params }) => Effect.succeed(`${params.b}/${params.d}`),
});
const decodedIdentity = Schema.Struct({ id: Schema.String });
const renameSlug = SchemaTransformation.transform({
  decode: ({ slug }: Readonly<{ slug: string }>) => ({ id: slug }),
  encode: ({ id }: Readonly<{ id: string }>) => ({ slug: id }),
});
const RenamedParamsPage = EFFRONT.Page.make({
  params: Schema.Struct({ slug: Schema.String }).pipe(Schema.decodeTo(decodedIdentity, renameSlug)),
  render: ({ params }) => Effect.succeed(params.id),
});

const middleware = EFFRONT.Middleware.make((httpEffect) => httpEffect);
EFFRONT.withMiddleware(middleware).Routes.make();
EFFRONT.Middleware.make(
  // @ts-expect-error Middleware must handle every typed failure it introduces.
  // Intentional invalid Effect fixture
  (httpEffect) => Effect.andThen(Effect.fail("failure"), httpEffect),
);

const notesRoutes = EFFRONT.Routes.make().page("/", HomePage).page("/history", HistoryPage);
const mountedRoutes = EFFRONT.Routes.make().mount("/notes", notesRoutes);
const knownNotesPath: RoutesPaths<typeof mountedRoutes> = "/notes/history";
expectTypeOf(knownNotesPath);
// @ts-expect-error Runtime paths are private to the route compiler.
expectTypeOf(mountedRoutes.paths);
// @ts-expect-error Runtime pages are private to the route compiler.
expectTypeOf(mountedRoutes.pages);
// @ts-expect-error Runtime mounts are private to the route compiler.
expectTypeOf(mountedRoutes.mounts);

const dynamicRoutes = EFFRONT.Routes.make().page("/schedule/:day", DayPage);
const knownDynamicPath: RoutesPaths<typeof dynamicRoutes> = "/schedule/:day";
expectTypeOf(knownDynamicPath);
// @ts-expect-error A static Page cannot satisfy a dynamic route.
EFFRONT.Routes.make().page("/schedule/:day", HomePage);
// @ts-expect-error A dynamic Page cannot satisfy a static route.
EFFRONT.Routes.make().page("/schedule/saturday", DayPage);
// @ts-expect-error The Page Schema key must match the path parameter name.
EFFRONT.Routes.make().page("/schedule/:day", SlugPage);
// @ts-expect-error Page implementation details are not part of the authoring API.
expectTypeOf(DayPage.component);

const nestedRoutes = EFFRONT.Routes.make().page("/a/:b/c/:d", NestedParamsPage);
const knownNestedPath: RoutesPaths<typeof nestedRoutes> = "/a/:b/c/:d";
expectTypeOf(knownNestedPath);
// @ts-expect-error The Page Schema must contain both nested parameter names.
EFFRONT.Routes.make().page("/a/:b/c/:d", DayPage);
// @ts-expect-error Parameter names must remain unique across the complete pattern.
EFFRONT.Routes.make().page("/a/:b/c/:b", NestedParamsPage);
// @ts-expect-error Route parameters describe the Schema input, not its decoded output.
EFFRONT.Routes.make().page("/:id", RenamedParamsPage);

declare const uncertainPath: "/first" | "/second";
const widenedPath: AbsolutePath = "/schedule/:day";
const forgetPageContract = (page: AnyPageDefinition<never>): AnyPageDefinition<never> => page;
const widenedPage = forgetPageContract(HomePage);
const widenedRoutes: AnyRoutes<never> = EFFRONT.Routes.make().page("/", HomePage);
// @ts-expect-error A widened path cannot provide exact parameter inference.
EFFRONT.Routes.make().page(widenedPath, HomePage);
// @ts-expect-error One route declaration must have one literal pattern.
EFFRONT.Routes.make().page(uncertainPath, HomePage);
// @ts-expect-error A widened Page no longer proves whether it owns parameters.
EFFRONT.Routes.make().page("/", widenedPage);
// @ts-expect-error Widened Routes no longer carry their exact mounted paths.
EFFRONT.Routes.make().mount("/nested", widenedRoutes);

// @ts-expect-error An empty parameter Schema cannot match a parameterized path.
EFFRONT.Page.make({ params: Schema.Struct({}), render: () => Effect.succeed(emptyContent) });
const recordParamsPageOptions = {
  params: Schema.Record(Schema.String, Schema.String),
  render: () => Effect.succeed(emptyContent),
};
// @ts-expect-error A record Schema has no finite parameter-name set.
EFFRONT.Page.make(recordParamsPageOptions);
const nonStringParamsPageOptions = {
  params: Schema.Struct({ count: Schema.Finite }),
  render: () => Effect.succeed(emptyContent),
};
// @ts-expect-error Effect HTTP captures path parameters as strings.
EFFRONT.Page.make(nonStringParamsPageOptions);
const invalidNameParamsPageOptions = {
  params: Schema.Struct({ "invalid-name": Schema.String }),
  render: () => Effect.succeed(emptyContent),
};
// @ts-expect-error Schema keys must be valid Effect HTTP parameter names.
EFFRONT.Page.make(invalidNameParamsPageOptions);

// @ts-expect-error Dynamic params must occupy a complete path segment.
EFFRONT.Routes.make().page("/users/user:userId", HomePage);
// @ts-expect-error Dynamic parameter names must be unique.
EFFRONT.Routes.make().page("/users/:userId/:userId", HomePage);
// @ts-expect-error Route definitions must use canonical non-trailing slashes.
EFFRONT.Routes.make().page("/users/", HomePage);
// @ts-expect-error Route definitions cannot contain empty segments.
EFFRONT.Routes.make().page("/users//history", HomePage);
// @ts-expect-error Route definitions cannot contain URL-normalized dot segments.
EFFRONT.Routes.make().page("/users/../history", HomePage);
// @ts-expect-error Route definitions use decoded path text, not percent escapes.
EFFRONT.Routes.make().page("/users/%61", HomePage);
// @ts-expect-error Dynamic mount prefixes are not supported.
EFFRONT.Routes.make().mount("/:group", EFFRONT.Routes.make().page("/", HomePage));
EFFRONT.make({
  // @ts-expect-error The final application path uses the framework namespace.
  routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/_effront/dev", HomePage),
});
EFFRONT.make({
  // @ts-expect-error A parameterized pattern can match the framework namespace.
  routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/:slug/dev", SlugPage),
});
EFFRONT.make({
  // @ts-expect-error The framework namespace root is reserved.
  routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/_effront", HomePage),
});

const homeRoutes = EFFRONT.Routes.make().page("/", HomePage);
// @ts-expect-error A local Page cannot replace an existing Page.
homeRoutes.page("/", HistoryPage);
// @ts-expect-error Mounted paths cannot collide with existing paths.
homeRoutes.mount("/", EFFRONT.Routes.make().page("/", HistoryPage));

const scheduleRoutes = EFFRONT.Routes.make().page("/", HomePage).page("/:day", DayPage);
const mountedSchedule = EFFRONT.Routes.make()
  .page("/about", HomePage)
  .mount("/Schedule", scheduleRoutes);
// @ts-expect-error A mounted root still conflicts with a differently cased local path.
mountedSchedule.page("/schedule", HomePage);
// @ts-expect-error Renaming a parameter and changing case cannot hide a mounted collision.
mountedSchedule.page("/schedule/:slug", SlugPage);
mountedSchedule.mount(
  "/schedule",
  // @ts-expect-error A collision in any member rejects the whole mount, even with a distinct root.
  EFFRONT.Routes.make().page("/new", HomePage).page("/:slug", SlugPage),
);
// @ts-expect-error A mount must also detect collisions with pages added before it.
EFFRONT.Routes.make().page("/schedule/:slug", SlugPage).mount("/Schedule", scheduleRoutes);

// A specific static route can coexist with a parameterized matcher.
const extendedSchedule = mountedSchedule.page("/schedule/today", HomePage);
const annotatedSchedule: RoutesDefinition<
  never,
  false,
  "/about" | "/Schedule" | "/Schedule/:day" | "/schedule/today"
> = extendedSchedule;
expectTypeOf(annotatedSchedule);
const schedulePath: RoutesPaths<typeof extendedSchedule> = "/Schedule/:day";
expectTypeOf(schedulePath);
// @ts-expect-error Shape normalization must not replace the authored path or parameter name.
const normalizedSchedulePath: RoutesPaths<typeof extendedSchedule> = "/schedule/:slug";
expectTypeOf(normalizedSchedulePath);

const emptyRoutes = EFFRONT.Routes.make({ layout: RootLayout });
// @ts-expect-error Empty Routes do not contribute an application destination.
EFFRONT.Routes.make().mount("/empty", emptyRoutes);

const App = EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage),
});
// @ts-expect-error Compiled routes are private to framework runtime modules.
expectTypeOf(App.routes);
// @ts-expect-error The application Layer is private to framework runtime modules.
expectTypeOf(App.layer);
// @ts-expect-error The React adapter is private to framework runtime modules.
expectTypeOf(DayPage.component);
// @ts-expect-error The parameter Schema is private to framework runtime modules.
expectTypeOf(DayPage.paramsSchema);

const CreateReport = EFFRONT.ServerFn.make({
  handler: ({ title }) => {
    const inferredTitle: string = title;
    expectTypeOf(inferredTitle);
    return Effect.void;
  },
  input: Schema.fromFormData(Schema.Struct({ title: Schema.NonEmptyString })),
});
const directFormInvocation: Promise<void> = CreateReport(new FormData());
expectTypeOf(directFormInvocation);
const directServerFnForm = (): ReactNode => <form action={CreateReport} />;
expectTypeOf(directServerFnForm);
// @ts-expect-error A Server Function accepts the Schema's encoded input, not its decoded output.
expectTypeOf(CreateReport({ title: "Incident report" }));

const arbitraryLayout = ({ children }: Readonly<{ children: ReactNode }>): ReactNode => (
  <main>{children}</main>
);
const arbitraryLoading = (): ReactNode => <p>Loading...</p>;
const arbitraryPage = (): ReactNode => <h1>Home</h1>;
// @ts-expect-error Layout concerns must be created with EFFRONT.Layout.make.
EFFRONT.Routes.make({ layout: arbitraryLayout });
// @ts-expect-error Loading concerns must be created with EFFRONT.Loading.make.
EFFRONT.Routes.make({ loading: arbitraryLoading });
// @ts-expect-error Page concerns must be created with EFFRONT.Page.make.
EFFRONT.Routes.make().page("/", arbitraryPage);

const typecheckLoadingRenderers = (loading: boolean): void => {
  EFFRONT.Loading.make({
    // @ts-expect-error Loading must be immediately renderable, not asynchronous.
    // Intentional invalid renderer fixture
    render: async () => {
      const loadingContent = await Promise.resolve(<p>Loading...</p>);
      return loadingContent;
    },
  });
  EFFRONT.Loading.make({
    // @ts-expect-error Loading is service-free and does not execute an Effect operation.
    render: () => Effect.succeed(<p>Loading...</p>),
  });
  EFFRONT.Loading.make({
    // @ts-expect-error Loading cannot hide an Effect behind a union return type.
    render: () => (loading ? <p>Loading...</p> : Effect.succeed(<p>Loading...</p>)),
  });
};
expectTypeOf(typecheckLoadingRenderers);
