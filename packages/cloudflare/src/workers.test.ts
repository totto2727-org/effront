import { Effect, Layer } from "effect";
import { WorkersRequestContext } from "@effront/core/workers";
import { describe, expect, expectTypeOf, test, vi } from "vitest";
import {
  type CloudflareExecutionContext,
  createWorkersContextAccessors,
  getWorkersEnv,
  getWorkersRequestContext,
} from "./workers.ts";

type Env = Readonly<{ label: string }>;

describe("Cloudflare Workers context accessors", () => {
  test("fixes ExecutionContext while allowing application-specific Env", () => {
    const accessors = createWorkersContextAccessors<Env>();
    expectTypeOf(accessors.getWorkersEnv()).toEqualTypeOf<Effect.Effect<Env>>();
    expectTypeOf(accessors.getWorkersRequestContext()).toEqualTypeOf<
      Effect.Effect<WorkersRequestContext<Env, CloudflareExecutionContext>>
    >();
    expectTypeOf(getWorkersEnv()).toEqualTypeOf<Effect.Effect<unknown>>();
    expectTypeOf(getWorkersRequestContext<Env>()).toEqualTypeOf<
      Effect.Effect<WorkersRequestContext<Env, CloudflareExecutionContext>>
    >();
    expectTypeOf(getWorkersRequestContext()).toEqualTypeOf<
      Effect.Effect<WorkersRequestContext<unknown, CloudflareExecutionContext>>
    >();
    // @ts-expect-error Cloudflare only accepts an Env type; use the core factory for another host context.
    createWorkersContextAccessors<Env, Readonly<{ requestId: string }>>();
  });

  test("uses the core Layer and invokes the host's original waitUntil", async () => {
    const waitUntil = vi.fn<(promise: Promise<unknown>) => void>();
    const context = {
      env: { label: "cloudflare" },
      executionContext: { waitUntil },
      request: new Request("https://example.test/"),
    };
    const accessors = createWorkersContextAccessors<Env>();
    const pending = Promise.resolve("background result");
    await Effect.runPromise(
      Effect.gen(function* () {
        const env = yield* accessors.getWorkersEnv();
        const actual = yield* accessors.getWorkersRequestContext();
        expect(env).toBe(context.env);
        expect(actual).toBe(context);
        expect(yield* getWorkersRequestContext()).toBe(context);
        actual.executionContext.waitUntil(pending);
      }).pipe(Effect.provide(Layer.succeed(WorkersRequestContext, context))),
    );
    expect(waitUntil).toHaveBeenCalledExactlyOnceWith(pending);
  });
});
