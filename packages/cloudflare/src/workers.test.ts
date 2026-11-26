import { live } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { WorkersRequestContext } from "@effront/core/workers";
import { describe, expect, expectTypeOf, test, vi } from "vitest";
import {
  createWorkersContextAccessors,
  getWorkersEnv,
  getWorkersRequestContext,
} from "./workers.ts";
import type { CloudflareExecutionContext } from "./workers.ts";

type Env = Readonly<{ label: string }>;

describe("workers context accessors for Cloudflare", () => {
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

  live("uses the core Layer and invokes the host's original waitUntil", () =>
    Effect.gen(function* () {
      const context = {
        env: { label: "cloudflare" },
        executionContext: { waitUntil: vi.fn<(promise: Promise<unknown>) => void>() },
        request: new Request("https://example.test/"),
      };
      const accessors = createWorkersContextAccessors<Env>();
      const pending = Promise.resolve("background result");
      const layer = Layer.succeed(WorkersRequestContext, context);
      const read = Effect.gen(function* () {
        const env = yield* accessors.getWorkersEnv();
        const actual = yield* accessors.getWorkersRequestContext();
        const direct = yield* getWorkersRequestContext();
        actual.executionContext.waitUntil(pending);
        return { actual, direct, env };
      });
      const { actual, direct, env } = yield* read.pipe(Effect.provide(layer));
      expect(env).toBe(context.env);
      expect(actual).toBe(context);
      expect(direct).toBe(context);
      expect(context.executionContext.waitUntil).toHaveBeenCalledExactlyOnceWith(pending);
    }),
  );
});
