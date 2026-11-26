import { describe, expect, test } from "@effect/vitest";
import { Effect } from "effect";

import { Application } from "#core/application/effront.ts";
import { EFFRONT, HomePage, RootLayout, ScheduleLoading } from "./definition-render.fixture.tsx";

const OtherEFFRONT = Application.effront();
const OtherLayout = OtherEFFRONT.Layout.make({
  render: ({ children }) => Effect.succeed(children),
});
const OtherLoading = OtherEFFRONT.Loading.make({ render: () => <p>Loading...</p> });
const OtherPage = OtherEFFRONT.Page.make({ render: () => Effect.succeed(<h1>Other</h1>) });
const OtherMiddleware = OtherEFFRONT.Middleware.make((httpEffect) => httpEffect);
const OtherRoutes = OtherEFFRONT.Routes.make({ layout: OtherLayout }).page("/", OtherPage);

describe("application root validation", () => {
  test("requires a root Layout and a reachable Page at runtime", () => {
    expect(() =>
      EFFRONT.make({
        // @ts-expect-error Exercise runtime validation for a root without a Layout.
        routes: EFFRONT.Routes.make().page("/", HomePage),
      }),
    ).toThrow("must define a Layout");
    expect(() =>
      EFFRONT.make({
        // @ts-expect-error Exercise runtime validation for a root without a Page.
        routes: EFFRONT.Routes.make({ layout: RootLayout }),
      }),
    ).toThrow("must contain a Page");
  });
});

describe("route concerns from other application identities", () => {
  test("rejects route concerns created by a different EFFRONT module", () => {
    expect(() => EFFRONT.Routes.make({ layout: OtherLayout })).toThrow(
      "Layout was created by a different EFFRONT module.",
    );
    expect(() => EFFRONT.Routes.make({ loading: OtherLoading })).toThrow(
      "Loading was created by a different EFFRONT module.",
    );
    expect(() => EFFRONT.withMiddleware(OtherMiddleware)).toThrow(
      "Middleware was created by a different EFFRONT module.",
    );
  });

  test("rejects Pages and Routes registered from a different EFFRONT module", () => {
    expect(() =>
      EFFRONT.make({
        routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/", OtherPage),
      }),
    ).toThrow("created by a different EFFRONT module");
    expect(() => EFFRONT.make({ routes: OtherRoutes })).toThrow(
      "Root Routes were created by a different EFFRONT module.",
    );
    expect(() => EFFRONT.Routes.make().mount("/other", OtherRoutes)).toThrow(
      'Routes mounted at "/other" were created by a different EFFRONT module.',
    );
  });
});

describe("route concern types", () => {
  test("rejects same-EFFRONT members used as the wrong route concern", () => {
    const Leaf = EFFRONT.Component.make({ render: () => Effect.succeed(<p>Leaf</p>) });

    expect(() =>
      EFFRONT.Routes.make({
        // @ts-expect-error Loading is not a Layout concern.
        layout: ScheduleLoading,
      }),
    ).toThrow("Layout must be created with EFFRONT.Layout.make.");
    expect(() =>
      EFFRONT.Routes.make({
        // @ts-expect-error Layout is not a Loading concern.
        loading: RootLayout,
      }),
    ).toThrow("Loading must be created with EFFRONT.Loading.make.");
    expect(() =>
      EFFRONT.Routes.make().page(
        "/",
        // @ts-expect-error Component is not a Page concern.
        Leaf,
      ),
    ).toThrow("Page must be created with EFFRONT.Page.make.");
  });
});
