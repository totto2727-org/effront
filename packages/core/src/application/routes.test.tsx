import { describe, expect, test } from "@effect/vitest";
import { Effect, Schema, SchemaTransformation } from "effect";

import { Application } from "./effront.ts";
import { EFFRONT, HomePage, NestedParamsPage, Shell, SlugPage } from "./route-cases.fixture.tsx";
import { getRoutesState } from "./routes.ts";

const LoadingPage = EFFRONT.Loading.make({ render: () => <p>Loading...</p> });
const HistoryPage = EFFRONT.Page.make({ render: () => Effect.succeed(<h1>History</h1>) });
const DayPage = EFFRONT.Page.make({
  params: Schema.Struct({ day: Schema.Literals(["saturday", "sunday"]) }),
  render: ({ params }) => Effect.succeed(<h1>{params.day}</h1>),
});
const renamedKeys = SchemaTransformation.transform({
  decode: ({ slug }: Readonly<{ slug: string }>) => ({ id: slug }),
  encode: ({ id }: Readonly<{ id: string }>) => ({ slug: id }),
});
const renamedParams = Schema.Struct({ slug: Schema.String }).pipe(
  Schema.decodeTo(Schema.Struct({ id: Schema.String }), renamedKeys),
);
const RenamedParamsPage = EFFRONT.Page.make({
  params: renamedParams,
  render: ({ params }) => Effect.succeed(<h1>{params.id}</h1>),
});

describe("route collection and middleware scopes", () => {
  test("captures immutable middleware scopes from a derived EFFRONT view", () => {
    const First = EFFRONT.Middleware.make((httpEffect) => httpEffect);
    const Second = EFFRONT.Middleware.make((httpEffect) => httpEffect);
    const FirstScope = EFFRONT.withMiddleware(First);
    const SecondScope = FirstScope.withMiddleware(Second);
    const { middleware } = getRoutesState(SecondScope.Routes.make());
    expect({
      frozenFirst: Object.isFrozen(First),
      frozenScope: Object.isFrozen(middleware),
      middleware,
    }).toStrictEqual({ frozenFirst: true, frozenScope: true, middleware: [First, Second] });
    expect(() => FirstScope.withMiddleware(First)).toThrow("cannot appear twice in the same scope");
    const OtherEFFRONT = Application.effront();
    const OtherMiddleware = OtherEFFRONT.Middleware.make((httpEffect) => httpEffect);
    expect(() => EFFRONT.withMiddleware(OtherMiddleware)).toThrow(
      "created by a different EFFRONT module",
    );
  });

  test("composes immutable mountable route descriptions", () => {
    const empty = EFFRONT.Routes.make({ layout: Shell, loading: LoadingPage });
    const notesRoutes = EFFRONT.Routes.make().page("/", HomePage).page("/history", HistoryPage);
    const routes = empty.mount("/notes", notesRoutes);
    const state = getRoutesState(routes);
    const child = getRoutesState(notesRoutes);
    expect({
      child: child.paths,
      empty: getRoutesState(empty).paths,
      mounted: state.paths,
    }).toStrictEqual({
      child: ["/", "/history"],
      empty: [],
      mounted: ["/notes", "/notes/history"],
    });
    expect({
      childPage: Object.isFrozen(child.pages[0]),
      collection: Object.isFrozen(routes),
      mountedRoute: Object.isFrozen(state.mounts[0]),
      paths: Object.isFrozen(state.paths),
    }).toStrictEqual({ childPage: true, collection: true, mountedRoute: true, paths: true });
  });
});

describe("dynamic path schemas", () => {
  test("infers dynamic path params from Page schemas", () => {
    const routes = EFFRONT.Routes.make().page("/schedule/:day", DayPage);
    expect(getRoutesState(routes).paths).toStrictEqual(["/schedule/:day"]);
    expect(() =>
      // @ts-expect-error Exercise runtime validation for a parameter-free Page.
      EFFRONT.Routes.make().page("/schedule/:day", HomePage),
    ).toThrow("must declare a parameter Schema");
    expect(() =>
      // @ts-expect-error Exercise runtime validation for a parameterized Page.
      EFFRONT.Routes.make().page("/schedule/saturday", DayPage),
    ).toThrow("requires route parameters");
  });

  test("infers every parameter across a nested route pattern", () => {
    const routes = EFFRONT.Routes.make().page("/a/:b/c/:d", NestedParamsPage);
    expect(getRoutesState(routes).paths).toStrictEqual(["/a/:b/c/:d"]);
  });

  test("matches route names against the encoded Schema while rendering its decoded type", () => {
    const routes = EFFRONT.Routes.make().page("/:slug", RenamedParamsPage);
    expect(getRoutesState(routes).paths).toStrictEqual(["/:slug"]);
  });

  test("requires a finite, non-empty Schema of string-encoded path parameters", () => {
    const unknownInputPage = EFFRONT.Page.make({
      params: Schema.Struct({ value: Schema.Unknown }),
      render: ({ params }) => Effect.succeed(<h1>{typeof params.value}</h1>),
    });
    const routes = EFFRONT.Routes.make().page("/:value", unknownInputPage);
    expect(getRoutesState(routes).paths).toStrictEqual(["/:value"]);
  });
});

describe("canonical route grammar", () => {
  test("rejects invalid and reserved route paths at the type and runtime boundaries", () => {
    expect(() =>
      // @ts-expect-error Exercise runtime validation for malformed dynamic syntax.
      EFFRONT.Routes.make().page("/users/user:userId", HomePage),
    ).toThrow('Dynamic segments must use the ":parameter" convention');
    expect(() =>
      // @ts-expect-error Exercise canonical-path runtime validation.
      EFFRONT.Routes.make().page("/users/", HomePage),
    ).toThrow('cannot contain empty, ".", or ".." segments or end with "/"');
    expect(() =>
      // @ts-expect-error Exercise runtime validation for empty segments.
      EFFRONT.Routes.make().page("/users//history", HomePage),
    ).toThrow('cannot contain empty, ".", or ".." segments or end with "/"');
    expect(() =>
      // @ts-expect-error Exercise runtime validation for URL-normalized dot segments.
      EFFRONT.Routes.make().page("/users/../history", HomePage),
    ).toThrow('cannot contain empty, ".", or ".." segments or end with "/"');
    expect(() =>
      // @ts-expect-error Exercise runtime validation for percent escapes.
      EFFRONT.Routes.make().page("/users/%61", HomePage),
    ).toThrow(String.raw`cannot contain "?", "#", "%", ";", or "\"`);
  });
});

describe("reserved path and mount validation", () => {
  test("rejects duplicate names, dynamic mounts, and reserved framework paths", () => {
    expect(() =>
      // @ts-expect-error Exercise runtime validation for duplicate parameter names.
      EFFRONT.Routes.make().page("/users/:userId/:userId", HomePage),
    ).toThrow("Dynamic parameter names must be unique within a route");
    expect(() =>
      // @ts-expect-error Exercise runtime validation for a dynamic mount prefix.
      EFFRONT.Routes.make().mount("/:group", EFFRONT.Routes.make().page("/", HomePage)),
    ).toThrow('Routes cannot be mounted beneath parameterized path "/:group".');
    expect(() =>
      EFFRONT.make({
        // @ts-expect-error Exercise runtime validation for the reserved framework namespace.
        routes: EFFRONT.Routes.make({ layout: Shell }).page("/_effront/dev", HomePage),
      }),
    ).toThrow('uses the framework-reserved "/_effront" namespace');
    expect(() =>
      EFFRONT.make({
        // @ts-expect-error Exercise overlap detection for a parameterized framework route.
        routes: EFFRONT.Routes.make({ layout: Shell }).page("/:slug/dev", SlugPage),
      }),
    ).toThrow('uses the framework-reserved "/_effront" namespace');
    expect(() =>
      EFFRONT.make({
        // @ts-expect-error Exercise runtime validation for the namespace root.
        routes: EFFRONT.Routes.make({ layout: Shell }).page("/_effront", HomePage),
      }),
    ).toThrow('uses the framework-reserved "/_effront" namespace');
  });
});

describe("route collisions and empty mounts", () => {
  test("rejects duplicate paths introduced locally or by a mount", () => {
    const homeRoutes = EFFRONT.Routes.make().page("/", HomePage);
    expect(() =>
      // @ts-expect-error Exercise runtime validation for a duplicate local path.
      homeRoutes.page("/", HistoryPage),
    ).toThrow('Route "/" conflicts with an existing route pattern.');
    expect(() =>
      // @ts-expect-error Exercise runtime validation for a duplicate mounted path.
      homeRoutes.mount("/", EFFRONT.Routes.make().page("/", HistoryPage)),
    ).toThrow('Route "/" conflicts with an existing route pattern.');

    const dynamicRoutes = EFFRONT.Routes.make().page("/:day", DayPage);
    expect(() =>
      // @ts-expect-error Renaming a parameter does not create a distinct route pattern.
      dynamicRoutes.page("/:slug", SlugPage),
    ).toThrow('Route "/:slug" conflicts with an existing route pattern.');

    const caseInsensitiveRoutes = EFFRONT.Routes.make().page("/Schedule", HomePage);
    expect(() =>
      // @ts-expect-error Effect HTTP matches static path segments case-insensitively.
      caseInsensitiveRoutes.page("/schedule", HistoryPage),
    ).toThrow('Route "/schedule" conflicts with an existing route pattern.');
  });

  test("rejects mounting Routes that contain no pages", () => {
    const emptyRoutes = EFFRONT.Routes.make({ layout: Shell });
    expect(() =>
      // @ts-expect-error Exercise runtime validation for an empty mounted route collection.
      EFFRONT.Routes.make().mount("/empty", emptyRoutes),
    ).toThrow('Cannot mount empty Routes at "/empty".');
  });
});
