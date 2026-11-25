// oxlint-disable-next-line rules/no-node-imports -- React owns the async callbacks; AsyncLocalStorage propagates the request runtime across them.
import { AsyncLocalStorage } from "node:async_hooks";

import { Predicate } from "effect";
import type { Effect } from "effect";

export type RenderRuntime<Services> = <Output, Error>(
  effect: Effect.Effect<Output, Error, Services>,
) => Promise<Output>;

type RenderConcern = "Component" | "Layout" | "Page";

type BoundRenderRuntime = Readonly<{
  activeMiddleware: Readonly<object[]>;
  run: RenderRuntime<never>;
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

const renderScopeError = (message: string): TypeError =>
  // oxlint-disable-next-line rules/require-tagged-error -- Invalid calls retain the synchronous TypeError contract of authoring components.
  new TypeError(message);

export const makeRenderRuntimeContext = (): RenderRuntimeContext => {
  const storage = new AsyncLocalStorage<BoundRenderRuntime>();

  return {
    bind: (runtime, activeMiddleware, evaluate) =>
      storage.run({ activeMiddleware, run: runtime }, evaluate),
    // oxlint-disable-next-line typescript/promise-function-async -- React authoring callers receive synchronous errors for invalid render scopes.
    run: <Output, Error, Services>(
      concern: RenderConcern,
      effect: Effect.Effect<Output, Error, Services>,
      requiredMiddleware: Readonly<object[]>,
    ): Promise<Output> => {
      const bound = storage.getStore();
      if (Predicate.isNullish(bound)) {
        throw renderScopeError(
          `EFFRONT ${concern} rendered outside its application request runtime.`,
        );
      }
      const middlewareAvailable = requiredMiddleware.every((required) =>
        bound.activeMiddleware.includes(required),
      );
      if (!middlewareAvailable) {
        throw renderScopeError(
          `EFFRONT ${concern} requires a middleware scope that is not active for this request.`,
        );
      }

      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Authoring validates required services, and this request scope provides them at runtime.
      return bound.run(effect as Effect.Effect<Output, Error>);
    },
  };
};
