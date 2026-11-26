import { Context, Effect, Layer } from "effect";
import { createElement, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

import type { FlightPayload } from "#core/rsc/flight.ts";
import type { BrowserRenderObservers } from "./browser-error-boundary.tsx";
import { BrowserEffectRunner } from "./browser-effect-runner.ts";
import { BrowserRenderStatus, browserRenderStatuses } from "./browser-render-status.ts";
import { BrowserRenderer } from "./browser-renderer.ts";
import { BrowserRoot } from "./browser-root.tsx";
import { ReactDOMHydrationError } from "./react-dom-hydration-error.ts";

type Completed = Effect.Success<typeof Effect.void>;

const createObservers = (
  run: typeof BrowserEffectRunner.Service,
  status: typeof BrowserRenderStatus.Service,
): BrowserRenderObservers => ({
  onError: (error, info) => {
    const report = Effect.gen(function* () {
      yield* status.report(
        browserRenderStatuses.Failed({
          // oxlint-disable-next-line unicorn/no-null -- Keep the existing diagnostics representation when React omits the component stack.
          componentStack: info.componentStack ?? null,
          error,
        }),
      );
      yield* Effect.logError("Uncaught client render error.", error, info.componentStack);
    });
    // oxlint-disable-next-line typescript/no-floating-promises -- React invokes this observer synchronously. The browser fiber set owns its Effect.
    run(report);
  },
  onRendered: () => {
    // oxlint-disable-next-line typescript/no-floating-promises -- React invokes this observer synchronously. The browser fiber set owns its Effect.
    run(status.report(browserRenderStatuses.Rendered()));
  },
});

const makeReactDOMRenderer = Effect.gen(function* () {
  const renderer = yield* BrowserRenderer;
  const run = yield* BrowserEffectRunner;
  const status = yield* BrowserRenderStatus;

  const hydrate = Effect.fnUntraced(function* (
    container: Element | Document,
    initialPayload: FlightPayload,
  ) {
    const ready = Promise.withResolvers<Completed>();
    const observers = createObservers(run, status);
    yield* Effect.acquireRelease(
      Effect.try({
        catch: (cause) => new ReactDOMHydrationError({ cause }),
        try: () => {
          const tree = createElement(BrowserRoot, {
            ...observers,
            initialTree: initialPayload.routeTree,
            initialize: ready.resolve,
            renderer,
          });
          return hydrateRoot(container, createElement(StrictMode, undefined, tree), {
            formState: initialPayload.formState,
          });
        },
      }),
      (root) =>
        Effect.sync(() => {
          root.unmount();
        }),
    );
    // oxlint-disable-next-line typescript/promise-function-async -- Wait for the exact readiness promise resolved by the React layout effect.
    yield* Effect.promise(() => ready.promise);
  });

  return { hydrate };
});

export class ReactDOMRenderer extends Context.Service<ReactDOMRenderer>()(
  "effront/client/ReactDOMRenderer",
  { make: makeReactDOMRenderer },
) {
  // oxlint-disable-next-line rules/no-readonly -- The layer reference stays fixed for the browser runtime.
  public static readonly layer = Layer.effect(this, this.make);
}
