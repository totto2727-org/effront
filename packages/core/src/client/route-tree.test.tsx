import { describe, expect, test } from "@effect/vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { RouteOutlet } from "./route-outlet.tsx";
import { RouteTree } from "./route-tree.tsx";
import type { RouteTreeModel } from "#core/rsc/route-tree.ts";

// oxlint-disable-next-line unicorn/no-null -- The test exercises Flight's null child sentinel.
const noChild = null;

const page: RouteTreeModel = {
  child: noChild,
  content: <h1>Schedule</h1>,
  id: "/schedule/day-two",
};
const schedule: RouteTreeModel = {
  child: page,
  content: (
    <section>
      <aside>Schedule navigation</aside>
      <RouteOutlet />
    </section>
  ),
  id: "/schedule",
};
const root: RouteTreeModel = {
  child: schedule,
  content: (
    <main>
      <header>Conference</header>
      <RouteOutlet />
    </main>
  ),
  id: "/",
};

const emptyRoot: RouteTreeModel = {
  child: noChild,
  content: (
    <main>
      <RouteOutlet />
    </main>
  ),
  id: "/",
};

const renderUnboundOutlet = (): string => renderToStaticMarkup(<RouteOutlet />);

describe("route tree", () => {
  test("recursively renders a unary Layout ancestry", () => {
    expect(renderToStaticMarkup(<RouteTree root={root} />)).toBe(
      "<main><header>Conference</header><section><aside>Schedule navigation</aside><h1>Schedule</h1></section></main>",
    );
  });

  test("renders an intentionally empty child as null", () => {
    expect(renderToStaticMarkup(<RouteTree root={emptyRoot} />)).toBe("<main></main>");
  });

  test("rejects an outlet rendered outside a route node", () => {
    expect(renderUnboundOutlet).toThrow(TypeError);
    expect(renderUnboundOutlet).toThrow("RouteOutlet rendered outside its route node.");
  });
});
