import { expect, it, vi } from "@effect/vitest";
import { Deferred, Effect } from "effect";

import type { RenderRuntimeContext } from "../application/render-runtime";
import { RenderErrorObserver } from "./render-error-observer";

let renderSignal: AbortSignal | undefined;
let renderError: ((error: unknown) => void) | undefined;

vi.doMock("@vitejs/plugin-rsc/rsc/server", () => ({
  renderToReadableStream: (
    _model: unknown,
    options?: {
      readonly onError?: (error: unknown) => void;
      readonly signal?: AbortSignal;
    },
  ) => {
    renderSignal = options?.signal;
    renderError = options?.onError;
    return new ReadableStream<Uint8Array>();
  },
}));

const { FlightRenderer } = await import("./flight-renderer");

it.effect("interrupts application work when its Flight render is released", () =>
  Effect.scoped(
    Effect.gen(function* () {
      let runApplicationWork: (() => Promise<never>) | undefined;
      const started = yield* Deferred.make<void>();
      const interrupted = yield* Deferred.make<void>();
      const renderRuntime: RenderRuntimeContext = {
        bind: (runtime, _middleware, evaluate) => {
          runApplicationWork = () =>
            runtime(
              Deferred.succeed(started, void 0).pipe(
                Effect.andThen(Effect.never),
                Effect.onInterrupt(() => Deferred.succeed(interrupted, void 0)),
              ),
            );
          return evaluate();
        },
        run: () => {
          throw new TypeError("Unexpected request runtime invocation.");
        },
      };
      const renderer = yield* FlightRenderer;
      const flight = yield* renderer.render<never>({
        formState: null,
        middleware: [],
        renderRuntime,
        routeTree: {
          child: null,
          content: null,
          id: "root",
        },
        serverFnResult: null,
      });
      if (runApplicationWork === undefined) {
        return yield* Effect.die("Expected Flight rendering to bind its request runtime.");
      }

      const applicationWork = runApplicationWork();
      const applicationWorkOutcome = applicationWork.then(
        () => "completed" as const,
        () => "interrupted" as const,
      );
      yield* Deferred.await(started);
      expect(flight.signal).toBe(renderSignal);
      expect(renderSignal?.aborted).toBe(false);

      yield* flight.release;

      yield* Deferred.await(interrupted);
      const applicationOutcome = yield* Effect.promise(() => applicationWorkOutcome);
      expect(applicationOutcome).toBe("interrupted");
      expect(renderSignal?.aborted).toBe(true);
    }).pipe(Effect.provide(FlightRenderer.layer)),
  ),
);

it.effect("captures independent observers before deferred Flight errors are reported", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const renderer = yield* FlightRenderer;
      const observations = [0, 0];
      const renderRuntime: RenderRuntimeContext = {
        bind: (_runtime, _middleware, evaluate) => evaluate(),
        run: () => {
          throw new TypeError("Unexpected request runtime invocation.");
        },
      };
      const options = {
        formState: null,
        middleware: [],
        renderRuntime,
        routeTree: { child: null, content: null, id: "root" },
        serverFnResult: null,
      };
      const first = yield* renderer.render<never>(options).pipe(
        Effect.provideService(RenderErrorObserver, () => {
          observations[0] = observations[0]! + 1;
        }),
      );
      const firstError = renderError;
      const second = yield* renderer.render<never>(options).pipe(
        Effect.provideService(RenderErrorObserver, () => {
          observations[1] = observations[1]! + 1;
        }),
      );
      const secondError = renderError;
      expect(yield* RenderErrorObserver).toBeUndefined();
      expect(observations).toEqual([0, 0]);
      expect(firstError).toBeTypeOf("function");
      expect(secondError).toBeTypeOf("function");

      // React invokes these callbacks after the handler's provision has returned.
      // The notification must be synchronous and retain its own request identity.
      yield* Effect.sync(() => {
        secondError?.(new Error("second render failed"));
        expect(observations).toEqual([0, 1]);
        firstError?.(new Error("first render failed"));
        expect(observations).toEqual([1, 1]);
      });
      yield* first.release;
      yield* second.release;
    }).pipe(Effect.provide(FlightRenderer.layer)),
  ),
);
