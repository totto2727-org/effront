import { Function, Predicate } from "effect";
import type { Layer } from "effect";

import { NavigationApi } from "#core/client/navigation-api.ts";
import { absentNavigationValue } from "./client-routing-events.fixture.ts";
import type { TestNavigateEvent } from "./client-routing-events.fixture.ts";

type NavigateListener = (event: NavigateEvent) => void;

type TestHistoryEntry = NavigationHistoryEntry & Readonly<{ url: string }>;

type NativeNavigation = Readonly<{
  options: Readonly<{ history: "push" | "replace"; info: unknown }>;
  url: string;
}>;

const initialHistoryIndex = 0;

export const makeNavigationEntry = (key: string, url: string, id = key): TestHistoryEntry =>
  Object.assign(new EventTarget(), {
    getState: Function.constUndefined,
    id,
    index: initialHistoryIndex,
    key,
    ondispose: absentNavigationValue,
    sameDocument: true,
    url,
  });

const invalidHistoryMode = (): TypeError =>
  // oxlint-disable-next-line rules/require-tagged-error -- An invalid native navigation fixture invocation is a TypeError.
  new TypeError("Expected an explicit push or replace navigation.");

export class TestNavigationApi {
  private listener: NavigateListener | undefined;
  public currentEntry = makeNavigationEntry("day-one", "https://effront.test/schedule/day-one");
  public nativeNavigations: NativeNavigation[] = [];

  public addEventListener(_type: "navigate", listener: NavigateListener): void {
    this.listener = listener;
  }

  public removeEventListener(_type: "navigate", listener: NavigateListener): void {
    if (this.listener === listener) {
      this.listener = undefined;
    }
  }

  public navigate(url: string | URL, options?: NavigationNavigateOptions): NavigationResult {
    if (options?.history !== "push" && options?.history !== "replace") {
      throw invalidHistoryMode();
    }
    this.nativeNavigations.push({
      options: { history: options.history, info: options.info },
      url: url.toString(),
    });
    return {
      committed: Promise.resolve(this.currentEntry),
      finished: Promise.resolve(this.currentEntry),
    };
  }

  public dispatch(event: TestNavigateEvent): void {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Node has no NavigateEvent. The fixture supplies all fields read by the router.
    this.listener?.(event as NavigateEvent);
  }

  public get isListening(): boolean {
    return Predicate.isNotNullish(this.listener);
  }
}

export const makeNavigationApiLayer = (
  navigation: TestNavigationApi,
  documentReplacements: string[] = [],
  reloadDocument: () => void = Function.constVoid,
): Layer.Layer<NavigationApi> =>
  NavigationApi.layerTest({
    getCurrentEntry: () => navigation.currentEntry,
    getCurrentUrl: () => navigation.currentEntry.url,
    getTransition: () => absentNavigationValue,
    navigate: (url, options) => navigation.navigate(url, options),
    reloadDocument,
    replaceDocument: (url) => {
      documentReplacements.push(url);
    },
    subscribe: (listener) => {
      navigation.addEventListener("navigate", listener);
      return () => {
        navigation.removeEventListener("navigate", listener);
      };
    },
  });
