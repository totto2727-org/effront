import { assert, describe, expect, it, test } from "@effect/vitest";
import type { Scope } from "effect";
import { Effect, FiberSet, Layer, Schema } from "effect";
import type { ReactNode } from "react";
import { isValidElement } from "react";

import { PageViewTransitionBoundary } from "#core/client/page-view-transition.tsx";
import { Application } from "./effront.ts";
import { getEFFRONTIdentity } from "./effront-identity.ts";
import type { PageViewTransitionConfig } from "./page-view-transition.ts";
import { PageViewTransition, resolvePageViewTransition } from "./page-view-transition.ts";
import { getPageState } from "./page.ts";
import { emptyNode } from "./render-interruption.fixture.ts";

const content = "page content";
const applicationSettings = { default: "application", enabled: false };

const boundaryConfig = (node: ReactNode): PageViewTransitionConfig => {
  assert(isValidElement<{ config: PageViewTransitionConfig; children: ReactNode }>(node));
  assert.strictEqual(node.type, PageViewTransitionBoundary);
  assert.strictEqual(node.props.children, content);
  return node.props.config;
};

const renderEmpty = (): Effect.Effect<typeof emptyNode> => Effect.succeed(emptyNode);

const renderBoundary = (
  viewTransition?: false | PageViewTransitionConfig,
  parameterized = false,
): Effect.Effect<PageViewTransitionConfig, never, Scope.Scope> =>
  Effect.gen(function* () {
    const EFFRONT = Application.effront();
    const page = parameterized
      ? EFFRONT.Page.make({
          params: Schema.Struct({ slug: Schema.String }),
          render: renderEmpty,
          viewTransition,
        })
      : EFFRONT.Page.make({ render: renderEmpty, viewTransition });
    const runtime = yield* FiberSet.makeRuntimePromise();
    const { renderRuntime } = getEFFRONTIdentity(page);
    const node = yield* Effect.promise(async () =>
      renderRuntime.bind(runtime, [], async () =>
        getPageState(page).boundary({ children: content }),
      ),
    );
    return boundaryConfig(node);
  });

it.effect("enables page transitions without requiring a service Layer", () =>
  Effect.gen(function* () {
    expect((yield* PageViewTransition).default).toStrictEqual({
      default: "auto",
      "hmr-refresh": "none",
      "navigation-ua-visual-transition": "none",
    });
    expect((yield* renderBoundary()).enabled).not.toBe(false);
  }),
);

it.effect("reads application Layer settings in the request render runtime", () =>
  Effect.gen(function* () {
    expect(yield* renderBoundary()).toMatchObject(applicationSettings);
  }).pipe(Effect.provide(Layer.succeed(PageViewTransition, applicationSettings))),
);

it.effect("allows static and parameterized pages to disable or re-enable transitions", () =>
  Effect.forEach([false, true], (parameterized) =>
    Effect.gen(function* () {
      expect(yield* renderBoundary(false, parameterized)).toStrictEqual({ enabled: false });
      expect(
        yield* renderBoundary({ enabled: true, share: "page-share" }, parameterized),
      ).toMatchObject({
        default: "application",
        enabled: true,
        share: "page-share",
      });
    }),
  ).pipe(Effect.provide(Layer.succeed(PageViewTransition, applicationSettings))),
);

it.effect("keeps concurrent request overrides isolated", () =>
  Effect.gen(function* () {
    const results = yield* Effect.all(
      ["first", "second"].map((defaultClass) =>
        renderBoundary().pipe(Effect.provideService(PageViewTransition, { default: defaultClass })),
      ),
      { concurrency: "unbounded" },
    );
    expect(results.map((result) => result.default)).toStrictEqual(["first", "second"]);
    expect((yield* renderBoundary()).default).toStrictEqual((yield* PageViewTransition).default);
  }),
);

it.effect("retains the built-in type policy with a partial application Layer", () =>
  Effect.gen(function* () {
    expect(yield* renderBoundary()).toMatchObject({
      default: {
        default: "auto",
        "hmr-refresh": "none",
        "navigation-ua-visual-transition": "none",
      },
      enter: "application-enter",
    });
  }).pipe(Effect.provide(Layer.succeed(PageViewTransition, { enter: "application-enter" }))),
);

describe("page view transition settings", () => {
  test("shallowly replaces type maps and forwards only public settings", () => {
    const defaults = {
      default: "global",
      privateValue: "not-flight",
      share: { default: "fade", "navigation-back": "back" },
    };
    expect(resolvePageViewTransition(defaults, { share: { default: "page" } })).toStrictEqual({
      default: "global",
      enabled: undefined,
      enter: undefined,
      exit: undefined,
      share: { default: "page" },
      update: undefined,
    });
  });
});
