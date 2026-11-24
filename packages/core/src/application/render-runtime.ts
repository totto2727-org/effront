import { AsyncLocalStorage } from "node:async_hooks";

import type { Effect } from "effect";

export type RenderRuntime<Services> = <Output, Error>(
  effect: Effect.Effect<Output, Error, Services>,
) => Promise<Output>;

type RenderConcern = "Component" | "Layout" | "Page";

type BoundRenderRuntime = Readonly<{
  activeMiddleware: Readonly<object[]>;
  run: RenderRuntime<any>;
}>;

export type RenderRuntimeContext = Readonly<{
  bind: <Services, Output>(
    runtime: RenderRuntime<Services>,
    activeMiddleware: Readonly<object[]>,
    evaluate: () => Output,
  ) => Output;
  run: <Output, Error, Services>(
    concern: RenderConcern,
    effect: Effect.Effect<Output, Error, Services>,
    requiredMiddleware: Readonly<object[]>,
  ) => Promise<Output>;
}>;

export const makeRenderRuntimeContext = (): RenderRuntimeContext => {
  const storage = new AsyncLocalStorage<BoundRenderRuntime>();

  return {
    bind: (runtime, activeMiddleware, evaluate) =>
      storage.run({ activeMiddleware, run: runtime }, evaluate),
    run: (concern, effect, requiredMiddleware) => {
      const bound = storage.getStore();
      if (bound === undefined) {
        throw new TypeError(`EFFRONT ${concern} rendered outside its application request runtime.`);
      }
      const middlewareAvailable = requiredMiddleware.every((required) =>
        bound.activeMiddleware.includes(required),
      );
      if (!middlewareAvailable) {
        throw new TypeError(
          `EFFRONT ${concern} requires a middleware scope that is not active for this request.`,
        );
      }

      return bound.run(effect);
    },
  };
};
