import { live } from "@effect/vitest";
import type { ApplicationDefinition } from "@effront/core";
import type { RuntimeContext } from "alchemy/RuntimeContext";
import { Context, Data, Effect } from "effect";
import type { Scope } from "effect";
import type { HttpRouter, HttpServerRequest } from "effect/http";
import { describe, expect, expectTypeOf, test } from "vite-plus/test";

import * as configuredDeployment from "./application.ts";
import { makeApplicationHttpEffect as makeConfiguredApplicationHttpEffect } from "./application-runtime.ts";
import * as deployment from "./deployment.ts";
import { applicationHttpEffect, makeApplicationHttpEffect } from "./runtime.ts";

class Capability extends Context.Service<Capability, string>()("effront/test/alchemy/Capability") {}

interface Details {
  message: string;
}
const Failures = Data.taggedEnum<
  Data.TaggedEnum<{
    ApplicationFailure: Details;
    GlobalFailure: Details;
    RouteFailure: Details;
  }>
>();
type ApplicationFailure = ReturnType<typeof Failures.ApplicationFailure>;
type GlobalFailure = ReturnType<typeof Failures.GlobalFailure>;
type RouteFailure = ReturnType<typeof Failures.RouteFailure>;

type RuntimeRequirements = RuntimeContext | Scope.Scope | HttpServerRequest.HttpServerRequest;
type RuntimeDefinition = ApplicationDefinition<never, never, Capability | RuntimeContext>;
type Loader = () => Promise<RuntimeDefinition>;

const noContext = (effect: Effect.Effect<unknown, unknown>): Effect.Effect<unknown, unknown> =>
  effect;

const invalidConstruction = (load: Loader): void => {
  // @ts-expect-error The configured application still requires Capability.
  noContext(makeConfiguredApplicationHttpEffect<RuntimeDefinition>());
  // @ts-expect-error A configured entry must be an Effront application definition.
  makeConfiguredApplicationHttpEffect<string>();
  // @ts-expect-error Omitting the application type cannot erase unknown requirements.
  noContext(makeConfiguredApplicationHttpEffect());
  // @ts-expect-error The existing entry requires an explicit loader.
  makeApplicationHttpEffect();
  // @ts-expect-error Construction requires Capability but excludes host RuntimeContext.
  noContext(makeApplicationHttpEffect(load));
};

describe("published deployment and react-server type contracts", () => {
  test("gives the build and runtime entries identical types", () => {
    expectTypeOf(deployment.makeApplicationHttpEffect).toEqualTypeOf(makeApplicationHttpEffect);
    expectTypeOf(deployment.applicationHttpEffect).toEqualTypeOf(applicationHttpEffect);
    expectTypeOf(configuredDeployment.makeApplicationHttpEffect).toEqualTypeOf(
      makeConfiguredApplicationHttpEffect,
    );
  });

  test("requires a typed application and its application capability", () => {
    expect(invalidConstruction).toBeTypeOf("function");
  });

  live("normalizes native router requirements and errors before configured capture", () =>
    Effect.gen(function* () {
      type Definition = ApplicationDefinition<
        Capability,
        ApplicationFailure,
        | HttpRouter.Request.From<"Requires", Capability>
        | HttpRouter.Request.From<"GlobalRequires", RuntimeContext>
        | HttpRouter.Request.From<"Error", RouteFailure>
      >;
      const construction = makeConfiguredApplicationHttpEffect<Definition>();
      expectTypeOf<Effect.Services<typeof construction>>().toEqualTypeOf<Capability>();
      const handler = yield* construction.pipe(Effect.provideService(Capability, "constructed"));
      expectTypeOf<Effect.Services<typeof handler>>().toEqualTypeOf<RuntimeRequirements>();
      type ActualFailures = Extract<
        Effect.Error<typeof handler>,
        ApplicationFailure | RouteFailure
      >;
      expectTypeOf<ActualFailures>().toEqualTypeOf<ApplicationFailure | RouteFailure>();
      expect(handler).toBeDefined();
    }),
  );
});

type MarkedRequirements =
  | HttpRouter.Request.From<"Requires", Capability>
  | HttpRouter.Request.From<"GlobalRequires", RuntimeContext>
  | HttpRouter.Request.From<"Error", RouteFailure>
  | HttpRouter.Request.From<"GlobalError", GlobalFailure>;
type MarkedDefinition = ApplicationDefinition<never, never, MarkedRequirements>;

const verifyMarked = (load: () => Promise<MarkedDefinition>): void => {
  const construction = makeApplicationHttpEffect(load);
  type Handler = Effect.Success<typeof construction>;
  type ActualFailures = Extract<Effect.Error<Handler>, RouteFailure | GlobalFailure>;
  expectTypeOf<Effect.Services<typeof construction>>().toEqualTypeOf<Capability>();
  expectTypeOf<Effect.Services<Handler>>().toEqualTypeOf<RuntimeRequirements>();
  expectTypeOf<ActualFailures>().toEqualTypeOf<RouteFailure | GlobalFailure>();
};

const verifyUncaptured = (
  load: Loader,
  options: Readonly<{ context?: Context.Context<Capability> }>,
): void => {
  const omitted = applicationHttpEffect<never, never, Capability | RuntimeContext, Capability>(
    load,
  );
  const optional = applicationHttpEffect(load, options);
  type Requirements = Capability | RuntimeRequirements;
  expectTypeOf<Effect.Services<typeof omitted>>().toEqualTypeOf<Requirements>();
  expectTypeOf<Effect.Services<typeof optional>>().toEqualTypeOf<Requirements>();
  // @ts-expect-error Supplying a capture type parameter alone cannot remove Capability.
  expectTypeOf<Effect.Services<typeof omitted>>().toEqualTypeOf<RuntimeRequirements>();
};

describe("explicit application loader type contracts", () => {
  test("normalizes native router requirements and preserves request-local requirements", () => {
    expect(verifyMarked).toBeTypeOf("function");
    expect(verifyUncaptured).toBeTypeOf("function");
  });
});
