// oxlint-disable-next-line import/no-unassigned-import -- Vitest registers the browser decoder fixture before loading the navigation runtime.
import "./client-routing-rsc.fixture.ts";

import { expect, it } from "@effect/vitest";
import { Array, Effect, Option } from "effect";
import { vi } from "vitest";

import {
  invokeNavigationHandler,
  makePrecommitController,
  prepareNavigation,
  runPrecommit,
} from "./client-routing-commit.fixture.ts";
import { makeNavigationEvent, TestAnchor } from "./client-routing-events.fixture.ts";
import { makeHttpClient } from "./client-routing-http.fixture.ts";
import { TestNavigationApi } from "./client-routing-navigation.fixture.ts";
import type { BrowserRenderRequest } from "./client-routing-renderer.fixture.ts";
import { makeBrowserRenderer, renderRequests } from "./client-routing-renderer.fixture.ts";
import { listen } from "./client-routing-router.fixture.ts";

const react = vi.hoisted((): { transitionTypes: string[] } => ({ transitionTypes: [] }));
vi.mock(import("react"), async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    addTransitionType: (type: string): void => {
      react.transitionTypes.push(type);
    },
  };
});

const browser = Effect.acquireRelease(
  Effect.sync(() => {
    react.transitionTypes.length = 0;
    vi.stubGlobal("HTMLAnchorElement", TestAnchor);
  }),
  () => Effect.sync(vi.unstubAllGlobals),
);

const target = "https://effront.test/schedule/day-two";

const publishWithVisualTransition = Effect.fn("effront.test.publishWithVisualTransition")(
  function* () {
    const navigation = new TestNavigationApi();
    const requestedUrls: string[] = [];
    const renders: BrowserRenderRequest[] = [];
    yield* listen(navigation, {
      httpClient: makeHttpClient(requestedUrls),
      renderer: makeBrowserRenderer(renders),
    });
    const pending = makeNavigationEvent({ hasUAVisualTransition: true });
    navigation.dispatch(pending.event);
    return { interception: pending.interception(), renders, requestedUrls };
  },
);

const settleRecordedCommit = Effect.fn("effront.test.settleRecordedCommit")(function* (
  interception: NavigationInterceptOptions | null,
) {
  const handlers: NavigationInterceptHandler[] = [];
  yield* runPrecommit(interception, makePrecommitController([], handlers));
  const handler = Option.getOrThrow(Array.head(handlers));
  // oxlint-disable-next-line typescript/promise-function-async -- Observe the native post-commit acknowledgement.
  yield* Effect.promise(() => invokeNavigationHandler(handler));
  return Array.length(handlers);
});

it.effect("splits a cancelable navigation between React commit and Flight completion", () =>
  Effect.gen(function* () {
    yield* browser;
    const { interception, renders, requestedUrls } = yield* publishWithVisualTransition();
    expect({
      immediateHandler: interception?.handler,
      postCommitHandlers: yield* settleRecordedCommit(interception),
      precommit: typeof interception?.precommitHandler,
    }).toStrictEqual({ immediateHandler: undefined, postCommitHandlers: 1, precommit: "function" });
    expect(requestedUrls).toStrictEqual([target]);
    expect(
      Array.map(renders, (render) => ({
        navigated: renderRequests.$is("Navigation")(render),
        route: render.routeTree.id,
      })),
    ).toStrictEqual([{ navigated: true, route: "root" }]);
    expect(react.transitionTypes).toStrictEqual([
      "navigation",
      "navigation-push",
      "navigation-ua-visual-transition",
      "navigation-forward",
    ]);
  }).pipe(Effect.scoped),
);

const interceptedLink = Effect.gen(function* () {
  const navigation = new TestNavigationApi();
  yield* listen(navigation);
  const anchor = new TestAnchor({
    effrontTransitionTypes: " docs-previous\tsection-change docs-previous\n",
  });
  const pending = makeNavigationEvent({ sourceElement: anchor });
  navigation.dispatch(pending.event);
  anchor.dataset["effrontTransitionTypes"] = "docs-next";
  return { navigation, pending };
});

it.effect("snapshots link types before loading and keeps them local to the navigation", () =>
  Effect.gen(function* () {
    yield* browser;
    const { navigation, pending } = yield* interceptedLink;
    expect(react.transitionTypes).toStrictEqual([]);
    yield* runPrecommit(pending.interception(), makePrecommitController());
    expect(react.transitionTypes).toStrictEqual([
      "navigation",
      "navigation-push",
      "navigation-forward",
      "docs-previous",
      "section-change",
    ]);
    react.transitionTypes.length = 0;
    yield* prepareNavigation(navigation, target);
    expect(react.transitionTypes).toStrictEqual([
      "navigation",
      "navigation-push",
      "navigation-forward",
    ]);
  }).pipe(Effect.scoped),
);

const applicationTypes = [
  "docs-jump",
  "NAVIGATION-BACKWARD",
  "none",
  "initial",
  "default",
  "constructor",
  "toString",
  "1custom",
  "custom/type",
  "étape-suivante",
];
const mixedTokens = [
  "navigation",
  "navigation-backward",
  "navigation-custom",
  "server-function",
  "hmr-refresh",
  ...applicationTypes,
].join(" ");

it.effect("reserves only EFFRONT-owned types and preserves application tokens unchanged", () =>
  Effect.gen(function* () {
    yield* browser;
    const navigation = new TestNavigationApi();
    const renders: BrowserRenderRequest[] = [];
    yield* listen(navigation, { renderer: makeBrowserRenderer(renders) });
    const pending = makeNavigationEvent({
      navigationType: "replace",
      sourceElement: new TestAnchor({ effrontTransitionTypes: mixedTokens }),
    });
    navigation.dispatch(pending.event);
    yield* runPrecommit(pending.interception(), makePrecommitController());
    expect(renders).toHaveLength(1);
    expect(react.transitionTypes).toStrictEqual([
      "navigation",
      "navigation-replace",
      ...applicationTypes,
    ]);
  }).pipe(Effect.scoped),
);

it.effect("does not read link types for a history traversal", () =>
  Effect.gen(function* () {
    yield* browser;
    const navigation = new TestNavigationApi();
    yield* listen(navigation);
    const readTypes = vi.fn<() => string>(() => "docs-next");
    const pending = makeNavigationEvent({
      navigationType: "traverse",
      sourceElement: new TestAnchor({
        get effrontTransitionTypes(): string {
          return readTypes();
        },
      }),
    });
    navigation.dispatch(pending.event);
    yield* runPrecommit(pending.interception(), makePrecommitController());
    expect(readTypes).not.toHaveBeenCalled();
    expect(react.transitionTypes).toStrictEqual([
      "navigation",
      "navigation-traverse",
      "navigation-backward",
    ]);
  }).pipe(Effect.scoped),
);
