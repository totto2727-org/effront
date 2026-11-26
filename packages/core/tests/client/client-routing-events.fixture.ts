import { Effect, Function, MutableRef } from "effect";
import { vi } from "vitest";

// oxlint-disable-next-line unicorn/no-null -- The browser's Navigation API represents absent fields with null.
export const absentNavigationValue = null;

export class TestAnchor {
  public dataset: DOMStringMap;

  public constructor(dataset: DOMStringMap) {
    this.dataset = dataset;
  }
}

export const nativeNavigationGlobals = Effect.acquireRelease(
  Effect.sync(() => {
    vi.stubGlobal("HTMLAnchorElement", TestAnchor);
  }),
  () => Effect.sync(vi.unstubAllGlobals),
);

export type TestNavigateEvent = Event &
  Pick<
    NavigateEvent,
    | "canIntercept"
    | "destination"
    | "downloadRequest"
    | "formData"
    | "hasUAVisualTransition"
    | "hashChange"
    | "info"
    | "intercept"
    | "navigationType"
    | "signal"
  >;

export type TestNavigateEventOverrides = Partial<
  Pick<
    NavigateEvent,
    | "canIntercept"
    | "downloadRequest"
    | "formData"
    | "hasUAVisualTransition"
    | "hashChange"
    | "info"
    | "navigationType"
    | "signal"
  >
> &
  Readonly<{
    cancelable?: boolean;
    destination?: Readonly<{ id?: string; key?: string; url: string }>;
    sourceElement?: Pick<HTMLAnchorElement, "dataset"> | null;
  }>;

type PendingNavigation = Readonly<{
  event: TestNavigateEvent;
  interception: () => NavigationInterceptOptions | null;
}>;

const missingHistoryIndex = -1;

const targetFor = ({
  id,
  key,
  url,
}: NonNullable<TestNavigateEventOverrides["destination"]>): NavigationDestination => ({
  getState: Function.constUndefined,
  id: id ?? key ?? "",
  index: missingHistoryIndex,
  key: key ?? "",
  sameDocument: false,
  url,
});

export const makeNavigationEvent = (
  overrides: TestNavigateEventOverrides = {},
): PendingNavigation => {
  const interception = MutableRef.make<NavigationInterceptOptions | null>(absentNavigationValue);
  const {
    cancelable = true,
    destination = { url: "https://effront.test/schedule/day-two" },
    ...eventOverrides
  } = overrides;
  const navigationType: NavigationType = "push";
  const event = Object.assign(new Event("navigate", { cancelable }), {
    canIntercept: true,
    destination: targetFor(destination),
    downloadRequest: absentNavigationValue,
    formData: absentNavigationValue,
    hasUAVisualTransition: false,
    hashChange: false,
    info: undefined,
    intercept: (options: NavigationInterceptOptions) => {
      MutableRef.set(interception, options);
    },
    navigationType,
    scroll: Function.constVoid,
    signal: new AbortController().signal,
    sourceElement: absentNavigationValue,
    userInitiated: true,
    ...eventOverrides,
  }) satisfies TestNavigateEvent;
  return { event, interception: () => MutableRef.get(interception) };
};
