import { describe, expect, test } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { EFFRONT, HomePage, NestedParamsPage, Shell, SlugPage } from "./route-cases.fixture.tsx";
import type { ValidRoutePath } from "./route-path.ts";
import { analyzeRoutePath } from "./route-path.ts";
import { getRoutesState } from "./routes.ts";

const PathPage = EFFRONT.Page.make({
  params: Schema.Struct({ path: Schema.String }),
  render: ({ params }) => Effect.succeed(<h1>{params.path}</h1>),
});

const checkNames = (): void => {
  // @ts-expect-error The schema must declare path, not slug.
  EFFRONT.Routes.make().page("/manual/*path", SlugPage);
  // @ts-expect-error Both regular and catch-all parameters must appear in the Schema.
  EFFRONT.Routes.make().page("/manual/:slug/*path", PathPage);
};

describe("named catch-all schema and mounts", () => {
  test("infers the terminal capture and mounts beneath a static prefix", () => {
    const child = EFFRONT.Routes.make().page("/*path", PathPage);
    const routes = EFFRONT.Routes.make({ layout: Shell }).mount("/manual", child);
    expect(getRoutesState(routes).paths).toStrictEqual(["/manual/*path"]);
    expect(() => EFFRONT.make({ routes })).not.toThrow();
    expect(analyzeRoutePath("/manual/*path")).toMatchObject({
      catchAll: "path",
      matcher: "/manual/*",
      parameterNames: ["path"],
      shapes: ["/manual/*", "/manual"],
    });
    const nested = EFFRONT.Routes.make().page("/a/:b/*d", NestedParamsPage);
    expect(getRoutesState(nested).paths).toStrictEqual(["/a/:b/*d"]);
  });

  test("requires the catch-all schema key and keeps static mount constraints", () => {
    expect(() =>
      // @ts-expect-error A catch-all Page requires a parameter Schema.
      EFFRONT.Routes.make().page("/manual/*path", HomePage),
    ).toThrow("must declare a parameter Schema");
    expect(checkNames).toBeTypeOf("function");
    expect(() =>
      // @ts-expect-error Catch-all mount prefixes are parameterized, not static.
      EFFRONT.Routes.make().mount("/manual/*path", EFFRONT.Routes.make().page("/", HomePage)),
    ).toThrow("cannot be mounted beneath parameterized path");
  });
});

describe("malformed catch-all paths", () => {
  test("rejects malformed wildcards at both grammar boundaries", () => {
    expect.hasAssertions();
    // This list is also a compile-time assertion: none of these literals may be ValidRoutePath.
    type Invalid =
      | "/manual/*"
      | "/manual/*path/more"
      | "/manual/prefix*path"
      | "/manual/**path"
      | "/manual/*bad-name"
      | "/manual/:path/*path";
    const invalid: Readonly<Invalid[]> = [
      "/manual/*",
      "/manual/*path/more",
      "/manual/prefix*path",
      "/manual/**path",
      "/manual/*bad-name",
      "/manual/:path/*path",
    ];
    type Accepted = { [Path in Invalid]: ValidRoutePath<Path> }[Invalid];
    const assertInvalid = (path: Accepted): never => path;
    invalid.forEach((path) => {
      // @ts-expect-error None of the malformed patterns is a valid route path.
      assertInvalid(path);
      expect(() => analyzeRoutePath(path)).toThrow(TypeError);
    });
  });
});

describe("catch-all route collisions", () => {
  test("rejects renamed wildcard duplicates and collisions with the empty-capture prefix", () => {
    const child = EFFRONT.Routes.make().page("/*path", PathPage);
    expect(() =>
      // @ts-expect-error Unmounted child catch-alls also reserve their empty prefix.
      child.page("/", HomePage),
    ).toThrow("conflicts with an existing route pattern");
    const routes = EFFRONT.Routes.make().page("/Manual/*path", PathPage);
    expect(() =>
      // @ts-expect-error Wildcard names do not distinguish route shapes.
      routes.page("/manual/*slug", SlugPage),
    ).toThrow("conflicts with an existing route pattern");
    expect(() =>
      // @ts-expect-error The catch-all already owns its empty-capture prefix.
      routes.page("/manual", HomePage),
    ).toThrow("conflicts with an existing route pattern");
    expect(() =>
      // @ts-expect-error Adding the catch-all after its root also conflicts.
      EFFRONT.Routes.make().page("/manual", HomePage).page("/manual/*path", PathPage),
    ).toThrow("conflicts with an existing route pattern");
  });

  test("accounts for catch-all prefixes when mounting and accepts more specific sibling routes", () => {
    expect(() =>
      EFFRONT.Routes.make()
        .page("/manual", HomePage)
        // @ts-expect-error Mounts must account for the wildcard's implicit root route.
        .mount("/manual", EFFRONT.Routes.make().page("/*path", PathPage)),
    ).toThrow("conflicts with an existing route pattern");
    const routes = EFFRONT.Routes.make().page("/Manual/*path", PathPage);
    expect(() =>
      routes.page("/manual/about", HomePage).page("/manual/:slug", SlugPage),
    ).not.toThrow();
  });
});

describe("reserved catch-all namespace", () => {
  test("rejects catch-alls overlapping the reserved framework namespace", () => {
    expect(() =>
      EFFRONT.make({
        // @ts-expect-error Root catch-alls overlap the reserved namespace.
        routes: EFFRONT.Routes.make({ layout: Shell }).page("/*path", PathPage),
      }),
    ).toThrow("framework-reserved");
    expect(() =>
      EFFRONT.make({
        // @ts-expect-error Named catch-alls beneath the framework namespace are reserved.
        routes: EFFRONT.Routes.make({ layout: Shell }).page("/_EFFRONT/*path", PathPage),
      }),
    ).toThrow("framework-reserved");
  });
});
