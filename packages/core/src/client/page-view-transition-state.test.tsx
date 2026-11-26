// oxlint-disable-next-line rules/no-node-imports -- The Node test inspects the actual stylesheet loaded by the client boundary.
import { readFile } from "node:fs/promises";

import type { ReactElement, ReactNode, useSyncExternalStore, ViewTransitionProps } from "react";
import { isValidElement, ViewTransition } from "react";
import { afterEach, assert, beforeEach, describe, expect, test, vi } from "vitest";

import { PageViewTransitionBoundary } from "./page-view-transition.tsx";

const readClientSnapshot = vi.hoisted(
  (): typeof useSyncExternalStore => (_subscribe, getSnapshot) => getSnapshot(),
);
vi.mock(import("react"), async (importOriginal) => {
  const react = await importOriginal();
  return { ...react, useSyncExternalStore: readClientSnapshot };
});

const content = "page content";

const setMotionPreference = (reduced: boolean): void => {
  vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
};

const transitionElement = (node: ReactNode): ReactElement<ViewTransitionProps> => {
  assert(isValidElement<ViewTransitionProps>(node));
  assert.strictEqual(node.type, ViewTransition);
  return node;
};

const expectReducedMotionStyles = async (): Promise<void> => {
  const css = await readFile(new URL("page-view-transition.css", import.meta.url), "utf8");
  assert.include(css, "@media (prefers-reduced-motion: reduce)");
  ["group", "image-pair", "old", "new"].forEach((pseudo) => {
    assert.include(css, `::view-transition-${pseudo}(root)`);
  });
  assert.include(css, "animation: none !important");
  assert.notInclude(css, "(*)");
};

describe("pageViewTransitionBoundary policy", () => {
  beforeEach(() => {
    setMotionPreference(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("uses a stable shared page name and forwards React event classes", () => {
    const config = {
      default: "page",
      enter: "enter",
      exit: "exit",
      share: { default: "share", "navigation-back": "back" },
      update: "update",
    };
    const element = transitionElement(PageViewTransitionBoundary({ children: content, config }));
    expect(element.props).toStrictEqual({ ...config, children: content, name: "effront-page" });
  });

  test("omits the React boundary when disabled", () => {
    expect(PageViewTransitionBoundary({ children: content, config: { enabled: false } })).toBe(
      content,
    );
  });

  test("keeps the React boundary stable with animation classes disabled for reduced motion", async () => {
    expect.hasAssertions();
    setMotionPreference(true);
    const element = transitionElement(
      PageViewTransitionBoundary({
        children: content,
        config: { default: "custom", enabled: true, share: "custom-share" },
      }),
    );
    expect(element.props).toStrictEqual({
      children: content,
      default: "none",
      enter: "none",
      exit: "none",
      name: "effront-page",
      share: "none",
      update: "none",
    });
    await expectReducedMotionStyles();
  });
});
