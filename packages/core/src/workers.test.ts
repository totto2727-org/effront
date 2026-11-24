import { live } from "@effect/vitest";
import { Effect, Exit, Layer, Result } from "effect";
import { describe, expect, expectTypeOf, test } from "vitest";
import {
  createWorkersContextAccessors,
  getWorkersEnv,
  getWorkersRequestContext,
  WorkersRequestContext,
} from "./workers.ts";

type Env = Readonly<{ label: string }>;
type ExecutionContext = Readonly<{ requestId: string }>;

const accessors = createWorkersContextAccessors<Env, ExecutionContext>();

describe("workers accessor types", () => {
  test("binds both types once and preserves generic default accessors", () => {
    expectTypeOf(accessors.getWorkersEnv()).toEqualTypeOf<Effect.Effect<Env>>();
    expectTypeOf(accessors.getWorkersRequestContext()).toEqualTypeOf<
      Effect.Effect<WorkersRequestContext<Env, ExecutionContext>>
    >();
    expectTypeOf(getWorkersEnv()).toEqualTypeOf<Effect.Effect<unknown>>();
    expectTypeOf(getWorkersRequestContext()).toEqualTypeOf<
      Effect.Effect<WorkersRequestContext<unknown, unknown>>
    >();
    expectTypeOf(getWorkersEnv<Env>()).toEqualTypeOf<Effect.Effect<Env>>();
    expectTypeOf(getWorkersRequestContext<Env, ExecutionContext>()).toEqualTypeOf<
      Effect.Effect<WorkersRequestContext<Env, ExecutionContext>>
    >();
  });
});

describe("workers request context lifetime", () => {
  live("reads the identical objects from one Layer through independently typed factories", () =>
    Effect.gen(function* () {
      const context = {
        env: { count: 1, label: "first" },
        executionContext: { requestId: "request-1" },
        request: new Request("https://example.test/"),
      };
      const counter = createWorkersContextAccessors<Readonly<{ count: number }>>();
      const layer = Layer.succeed(WorkersRequestContext, context);
      const [typedEnv, countedEnv, typedContext, genericContext] = yield* Effect.all([
        accessors.getWorkersEnv(),
        counter.getWorkersEnv(),
        accessors.getWorkersRequestContext(),
        getWorkersRequestContext(),
      ]).pipe(Effect.provide(layer));
      const genericEnv: unknown = yield* getWorkersEnv().pipe(Effect.provide(layer));
      expect(
        [typedEnv, countedEnv, genericEnv].every((environment) => environment === context.env),
      ).toBe(true);
      expect([typedContext, genericContext].every((request) => request === context)).toBe(true);
    }),
  );

  live("keeps pre-created reads request-local under concurrent contexts", () =>
    Effect.gen(function* () {
      const read = accessors.getWorkersRequestContext();
      const contexts = ["one", "two"].map((label) => ({
        env: { label },
        executionContext: { requestId: label },
        request: new Request(`https://example.test/${label}`),
      }));
      const results = yield* Effect.forEach(
        contexts,
        (context) => read.pipe(Effect.provideService(WorkersRequestContext, context)),
        { concurrency: "unbounded" },
      );
      expect(results.every((result, index) => result === contexts[index])).toBe(true);
    }),
  );
});

describe("workers accessors outside requests", () => {
  live("rejects reads outside a Fetch request instead of retaining the previous context", () =>
    Effect.gen(function* () {
      const outcome = yield* Effect.exit(accessors.getWorkersEnv());
      const defect = Result.getOrThrow(Exit.findDefect(outcome));
      expect(defect).toMatchObject({
        message: "Workers request context is only available while handling a Fetch request.",
      });
    }),
  );
});
