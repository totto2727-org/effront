import type { Layer } from "effect";
import { vi } from "vitest";

import { NavigationApi } from "#core/client/navigation-api.ts";

import { absentNavigationValue, makeNavigationEvent } from "./client-routing-events.fixture.ts";
import { makeNavigationEntry } from "./client-routing-navigation.fixture.ts";

export const entry = makeNavigationEntry("entry-one", "https://effront.test/schedule/day-one");

export class TestNavigation extends EventTarget {
  public currentEntry = entry;
  public navigate = vi.fn<NavigationApi["Service"]["navigate"]>(() => ({
    finished: Promise.resolve(entry),
  }));
  public reloadDocument = vi.fn<() => void>();
  public transition: NavigationTransition | null = absentNavigationValue;
}

export const routedNavigation = (): Event =>
  makeNavigationEvent({
    destination: { id: "entry-two", url: "https://effront.test/schedule/day-two" },
  }).event;

export const makeNavigationApiLayer = (navigation: TestNavigation): Layer.Layer<NavigationApi> =>
  NavigationApi.layerTest({
    getCurrentEntry: () => navigation.currentEntry,
    getCurrentUrl: () => entry.url,
    getTransition: () => navigation.transition,
    navigate: navigation.navigate,
    reloadDocument: navigation.reloadDocument,
    replaceDocument: vi.fn<NavigationApi["Service"]["replaceDocument"]>(),
    subscribe: (listener) => {
      const dispatch = (event: Event): void => {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The fixture dispatches the browser NavigateEvent fields used by route refresh.
        listener(event as NavigateEvent);
      };
      navigation.addEventListener("navigate", dispatch);
      return () => {
        navigation.removeEventListener("navigate", dispatch);
      };
    },
  });
