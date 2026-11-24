// oxlint-disable-next-line import/no-unassigned-import -- Vitest registers the browser decoder fixture before loading the navigation runtime.
import "./client-routing-rsc.fixture.ts";

import { expect, it } from "@effect/vitest";
import { Array, Effect, Exit, Predicate, Scope } from "effect";
import { vi } from "vitest";

import {
  invokeNavigationHandler,
  makePrecommitController,
  runPrecommit,
} from "./client-routing-commit.fixture.ts";
import {
  absentNavigationValue,
  makeNavigationEvent,
  TestAnchor,
} from "./client-routing-events.fixture.ts";
import type { TestNavigateEventOverrides } from "./client-routing-events.fixture.ts";
import { makeHttpClient, makeInvalidFlightClient } from "./client-routing-http.fixture.ts";
import { TestNavigationApi } from "./client-routing-navigation.fixture.ts";
import type { BrowserRenderRequest } from "./client-routing-renderer.fixture.ts";
import { makeBrowserRenderer } from "./client-routing-renderer.fixture.ts";
import { listen } from "./client-routing-router.fixture.ts";

const browser = Effect.acquireRelease(
  Effect.sync(() => {
    vi.stubGlobal("HTMLAnchorElement", TestAnchor);
  }),
  () => Effect.sync(vi.unstubAllGlobals),
);
const currentUrl = "https://effront.test/schedule/day-one";
const nextUrl = "https://effront.test/schedule/day-two";

const intercept = (
  navigation: TestNavigationApi,
  overrides: TestNavigateEventOverrides = {},
): NavigationInterceptOptions | null => {
  const pending = makeNavigationEvent(overrides);
  navigation.dispatch(pending.event);
  return pending.interception();
};

const postCommit = Effect.fn("effront.test.runPostCommit")(function* (
  interception: NavigationInterceptOptions | null,
) {
  const handler = interception?.handler;
  if (Predicate.isNullish(handler)) {
    return yield* Effect.die("Expected a post-commit handler.");
  }
  // oxlint-disable-next-line typescript/promise-function-async -- Wait on the browser handler's original acknowledgement.
  return yield* Effect.promise(() => invokeNavigationHandler(handler));
});

const nativeTraversal = { cancelable: false, navigationType: "traverse" } as const;

it.effect("uses a post-commit handler for a non-cancelable traversal", () =>
  Effect.gen(function* () {
    yield* browser;
    const navigation = new TestNavigationApi();
    const requestedUrls: string[] = [];
    yield* listen(navigation, { httpClient: makeHttpClient(requestedUrls) });
    const interception = intercept(navigation, nativeTraversal);
    expect(interception?.precommitHandler).toBeUndefined();
    expect(interception?.handler).toBeTypeOf("function");
    yield* postCommit(interception);
    expect(requestedUrls).toStrictEqual([nextUrl]);
  }).pipe(Effect.scoped),
);

const observeFailedFlight = Effect.fn("effront.test.observeFailedTraversal")(function* (
  overrides: TestNavigateEventOverrides,
) {
  yield* browser;
  const navigation = new TestNavigationApi();
  const reloadDocument = vi.fn<() => void>();
  yield* listen(navigation, { httpClient: makeInvalidFlightClient(), reloadDocument });
  yield* postCommit(intercept(navigation, { ...nativeTraversal, ...overrides }));
  return reloadDocument;
});

it.effect("reloads after a non-cancelable traversal fails to load Flight", () =>
  Effect.gen(function* () {
    const reloadDocument = yield* observeFailedFlight({});
    expect(reloadDocument).toHaveBeenCalledOnce();
  }).pipe(Effect.scoped),
);

it.effect("does not reload a superseded non-cancelable traversal", () =>
  Effect.gen(function* () {
    const reloadDocument = yield* observeFailedFlight({ signal: AbortSignal.abort() });
    expect(reloadDocument).not.toHaveBeenCalled();
  }).pipe(Effect.scoped),
);

it.effect("promotes a non-Flight response to native document navigation", () =>
  Effect.gen(function* () {
    yield* browser;
    const navigation = new TestNavigationApi();
    const httpClient = makeHttpClient([], "text/html");
    yield* listen(navigation, { httpClient });
    yield* runPrecommit(intercept(navigation), makePrecommitController());
    expect(navigation.nativeNavigations).toStrictEqual([
      {
        options: { history: "push", info: "effront-native-document" },
        url: nextUrl,
      },
    ]);
  }).pipe(Effect.scoped),
);

type Redirect = Readonly<{ options: NavigationNavigateOptions | undefined; url: string }>;
const observeRedirect = Effect.fn("effront.test.observeBrowserRedirect")(function* () {
  yield* browser;
  const navigation = new TestNavigationApi();
  const redirects: Redirect[] = [];
  const handlers: NavigationInterceptHandler[] = [];
  const renders: BrowserRenderRequest[] = [];
  yield* listen(navigation, { renderer: makeBrowserRenderer(renders) });
  const interception = intercept(navigation, { destination: { url: currentUrl } });
  yield* runPrecommit(interception, makePrecommitController(redirects, handlers));
  return { handlers, redirects, renders };
});

it.effect("redirects a cancelable navigation before committing its Flight tree", () =>
  Effect.gen(function* () {
    const { handlers, redirects, renders } = yield* observeRedirect();
    expect(redirects).toStrictEqual([{ options: { history: "auto" }, url: nextUrl }]);
    expect(renders).toHaveLength(1);
    expect(handlers).toHaveLength(1);
  }).pipe(Effect.scoped),
);

it.effect("falls back to document replacement for a redirected traversal", () =>
  Effect.gen(function* () {
    yield* browser;
    const navigation = new TestNavigationApi();
    const documentReplacements: string[] = [];
    yield* listen(navigation, { documentReplacements });
    const interception = intercept(navigation, {
      ...nativeTraversal,
      destination: { url: currentUrl },
    });
    yield* postCommit(interception);
    expect(documentReplacements).toStrictEqual([nextUrl]);
  }).pipe(Effect.scoped),
);

const nativeNavigations = (): TestNavigateEventOverrides[] => [
  { canIntercept: false },
  { hashChange: true },
  { downloadRequest: "" },
  { formData: new FormData() },
  { info: "react-transition" },
  { info: "effront-native-document" },
  { navigationType: "reload" },
];

it.effect("leaves navigations outside the router boundary to the browser", () =>
  Effect.gen(function* () {
    yield* browser;
    const navigation = new TestNavigationApi();
    const requestedUrls: string[] = [];
    yield* listen(navigation, { httpClient: makeHttpClient(requestedUrls) });
    const events = nativeNavigations();
    const callbacks = Array.map(events, (event) => intercept(navigation, event));
    expect(callbacks).toStrictEqual(Array.map(events, () => absentNavigationValue));
    expect(requestedUrls).toStrictEqual([]);
  }).pipe(Effect.scoped),
);

it.effect("removes the listener when its Effect scope closes", () =>
  Effect.gen(function* () {
    yield* browser;
    const navigation = new TestNavigationApi();
    const scope = yield* Scope.make();
    yield* listen(navigation).pipe(Scope.provide(scope));
    expect(navigation.isListening).toBe(true);
    yield* Scope.close(scope, Exit.void);
    expect(navigation.isListening).toBe(false);
  }).pipe(Effect.scoped),
);
