import { Effect, Layer } from "effect";
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

describe("createWorkersContextAccessors", () => {
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

  test("reads the identical objects from one Layer through independently typed factories", async () => {
    const context = {
      env: { label: "first", count: 1 },
      executionContext: { requestId: "request-1" },
      request: new Request("https://example.test/"),
    };
    const counter = createWorkersContextAccessors<Readonly<{ count: number }>>();
    const observed = await Effect.runPromise(
      Effect.all([
        accessors.getWorkersEnv(),
        counter.getWorkersEnv(),
        getWorkersEnv(),
        accessors.getWorkersRequestContext(),
        getWorkersRequestContext(),
      ]).pipe(Effect.provide(Layer.succeed(WorkersRequestContext, context))),
    );
    expect(observed[0]).toBe(context.env);
    expect(observed[1]).toBe(context.env);
    expect(observed[2]).toBe(context.env);
    expect(observed[3]).toBe(context);
    expect(observed[4]).toBe(context);
  });

  test("keeps pre-created reads request-local under concurrent contexts", async () => {
    const read = accessors.getWorkersRequestContext();
    const contexts = ["one", "two"].map((label) => ({
      env: { label },
      executionContext: { requestId: label },
      request: new Request(`https://example.test/${label}`),
    }));
    const results = await Promise.all(
      contexts.map((context) =>
        Effect.runPromise(read.pipe(Effect.provideService(WorkersRequestContext, context))),
      ),
    );
    for (const [index, result] of results.entries()) {
      expect(result).toBe(contexts[index]);
    }
  });

  test("rejects reads outside a Fetch request instead of retaining the previous context", async () => {
    await expect(Effect.runPromise(accessors.getWorkersEnv())).rejects.toThrow(
      "Workers request context is only available while handling a Fetch request.",
    );
  });
});
