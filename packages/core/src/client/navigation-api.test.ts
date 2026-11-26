import { afterEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { vi } from "vitest";

import { NavigationApi } from "./navigation-api.ts";

describe("browser navigation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.effect("supports document refresh without the Navigation API", () => {
    const location = {
      href: "https://effront.test/catalog/primary",
      reload: vi.fn<() => void>(),
      replace: vi.fn<(url: string) => void>(),
    };
    vi.stubGlobal("location", location);
    // oxlint-disable-next-line unicorn/no-useless-undefined -- The absent browser API is the behavior under test.
    vi.stubGlobal("navigation", undefined);

    return Effect.gen(function* () {
      const api = yield* NavigationApi;
      expect(api.getCurrentEntry()).toBeNull();
      expect(api.getTransition()).toBeNull();
      expect(api.getCurrentUrl()).toBe(location.href);
      const unsubscribe = api.subscribe(vi.fn<(event: NavigateEvent) => void>());
      unsubscribe();
      api.reloadDocument();
      api.replaceDocument("/catalog/secondary");
      expect(location.reload).toHaveBeenCalledOnce();
      expect(location.replace).toHaveBeenCalledWith("/catalog/secondary");
    }).pipe(Effect.provide(NavigationApi.layer));
  });

  it.effect("subscribes and unsubscribes when the Navigation API is available", () => {
    const navigation = new EventTarget();
    vi.stubGlobal("navigation", navigation);

    return Effect.gen(function* () {
      const api = yield* NavigationApi;
      const listener = vi.fn<(event: NavigateEvent) => void>();
      const unsubscribe = api.subscribe(listener);
      navigation.dispatchEvent(new Event("navigate"));
      expect(listener).toHaveBeenCalledOnce();
      unsubscribe();
      navigation.dispatchEvent(new Event("navigate"));
      expect(listener).toHaveBeenCalledOnce();
    }).pipe(Effect.provide(NavigationApi.layer));
  });
});
