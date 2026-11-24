import { describe, expect, it } from "@effect/vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { PageViewTransitionBoundary } from "./page-view-transition.tsx";

describe("PageViewTransitionBoundary SSR", () => {
  it("renders the same page HTML without adding wrapper elements", () => {
    [
      {},
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

  it("supports empty pages without accessing browser APIs during SSR", () => {
    expect(
      renderToStaticMarkup(
        <PageViewTransitionBoundary config={{}}>{null}</PageViewTransitionBoundary>,
      ),
    ).toBe("");
  });
});
