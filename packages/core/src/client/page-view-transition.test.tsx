import { describe, expect, test } from "@effect/vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { PageViewTransitionBoundary } from "./page-view-transition.tsx";

const defaults = {};
// oxlint-disable-next-line unicorn/no-null -- React represents the empty page under this boundary as null.
const emptyPage = null;

describe("pageViewTransitionBoundary SSR", () => {
  test("renders the same page HTML without adding wrapper elements", () => {
    expect.hasAssertions();
    [
      defaults,
      { enabled: false },
      { default: "page", share: { default: "fade", "navigation-back": "back" } },
    ].forEach((config) => {
      expect(
        renderToStaticMarkup(
          <PageViewTransitionBoundary config={config}>
            <h1>Page</h1>
            <p>Content</p>
          </PageViewTransitionBoundary>,
        ),
      ).toBe("<h1>Page</h1><p>Content</p>");
    });
  });

  test("supports empty pages without accessing browser APIs during SSR", () => {
    expect(
      renderToStaticMarkup(
        <PageViewTransitionBoundary config={defaults}>{emptyPage}</PageViewTransitionBoundary>,
      ),
    ).toBe("");
  });
});
