import { describe, expect, it, test } from "@effect/vitest";
import type { Scope } from "effect";
import { Context, Effect, FiberSet } from "effect";

import type { RenderRuntime } from "./render-runtime.ts";
import { makeRenderRuntimeContext } from "./render-runtime.ts";

class RequestLabel extends Context.Service<RequestLabel, Readonly<{ value: string }>>()(
  "effront/tests/application/render-runtime/RequestLabel",
) {}

const runtimeWithLabel = (
  value: string,
): Effect.Effect<RenderRuntime<RequestLabel>, never, Scope.Scope> =>
  FiberSet.makeRuntimePromise<RequestLabel>().pipe(Effect.provideService(RequestLabel, { value }));

describe("renderRuntimeContext", () => {
  test("throws a programmer error when work runs outside a bound render runtime", () => {
    const context = makeRenderRuntimeContext();
    const run = (): unknown => context.run("Component", Effect.void, []);
    expect(run).toThrow(
      expect.objectContaining({
        message: "EFFRONT Component rendered outside its application request runtime.",
        name: "TypeError",
      }),
    );
  });

  it.effect("keeps interleaved asynchronous render runners isolated", () =>
    Effect.gen(function* () {
      const context = makeRenderRuntimeContext();
      const firstReady = Promise.withResolvers<boolean>();
      const releaseFirst = Promise.withResolvers<boolean>();
      const readLabel = Effect.map(RequestLabel, ({ value }) => value);
      const [firstRuntime, secondRuntime] = yield* Effect.all([
        runtimeWithLabel("first"),
        runtimeWithLabel("second"),
      ]);
      const first = context.bind(firstRuntime, [], async () => {
        await Promise.resolve();
        firstReady.resolve(true);
        await releaseFirst.promise;
        return context.run("Component", readLabel, []);
      });

      yield* Effect.promise(async () => firstReady.promise);
      const second = context.bind(secondRuntime, [], async () => {
        try {
          return await context.run("Component", readLabel, []);
        } finally {
          releaseFirst.resolve(true);
        }
      });
      const labels = yield* Effect.promise(async () => Promise.all([first, second]));
      expect(labels).toStrictEqual(["first", "second"]);
    }),
  );
});
