import { describe, expect, test } from "@effect/vitest";

import {
  isRoutedNavigation,
  NativeDocumentNavigationInfo,
  preserveRequestedHash,
} from "./navigation-routing.ts";

type RoutingFields = Parameters<typeof isRoutedNavigation>[0];
// oxlint-disable-next-line unicorn/no-null -- A native navigation event uses null for absent form and download fields.
const absent = null;

const makeEvent = (overrides: Partial<RoutingFields> = {}): RoutingFields => ({
  canIntercept: true,
  downloadRequest: absent,
  formData: absent,
  hashChange: false,
  info: undefined,
  navigationType: "push",
  ...overrides,
});

describe("navigation eligibility", () => {
  test("routes an ordinary same-document navigation", () => {
    expect(isRoutedNavigation(makeEvent())).toBe(true);
    expect(isRoutedNavigation(makeEvent({ navigationType: "replace" }))).toBe(true);
    expect(isRoutedNavigation(makeEvent({ navigationType: "traverse" }))).toBe(true);
  });

  test("leaves navigations the router does not own to the browser", () => {
    expect(isRoutedNavigation(makeEvent({ canIntercept: false }))).toBe(false);
    expect(isRoutedNavigation(makeEvent({ hashChange: true }))).toBe(false);
    expect(isRoutedNavigation(makeEvent({ downloadRequest: "" }))).toBe(false);
    const formData = new FormData();
    expect(isRoutedNavigation(makeEvent({ formData }))).toBe(false);
    expect(isRoutedNavigation(makeEvent({ navigationType: "reload" }))).toBe(false);
  });

  test("leaves navigations EFFRONT itself dispatches to the browser", () => {
    expect(isRoutedNavigation(makeEvent({ info: NativeDocumentNavigationInfo }))).toBe(false);
    expect(isRoutedNavigation(makeEvent({ info: "react-transition" }))).toBe(false);
  });
});

describe("navigation redirects and fragments", () => {
  const requested = new URL("https://effront.test/schedule#session-4");

  test("reattaches the requested fragment when the server resolved the same location", () => {
    const resolved = preserveRequestedHash(requested, new URL("https://effront.test/schedule"));

    expect(resolved.href).toBe("https://effront.test/schedule#session-4");
  });

  test("keeps a fragment the server resolved for itself", () => {
    const resolved = preserveRequestedHash(requested, new URL("https://effront.test/schedule#top"));

    expect(resolved.href).toBe("https://effront.test/schedule#top");
  });

  test("leaves a redirected location untouched", () => {
    expect(
      preserveRequestedHash(requested, new URL("https://effront.test/schedule/saturday")).href,
    ).toBe("https://effront.test/schedule/saturday");
    expect(
      preserveRequestedHash(requested, new URL("https://effront.test/schedule?day=1")).href,
    ).toBe("https://effront.test/schedule?day=1");
    expect(preserveRequestedHash(requested, new URL("https://other.test/schedule")).href).toBe(
      "https://other.test/schedule",
    );
  });

  test("adds nothing when the requested location carried no fragment", () => {
    const resolved = preserveRequestedHash(
      new URL("https://effront.test/schedule"),
      new URL("https://effront.test/schedule"),
    );

    expect(resolved.href).toBe("https://effront.test/schedule");
  });
});
