import { expect, it, vi } from "@effect/vitest";
import { Data, Deferred, Effect, MutableRef, Option } from "effect";

import type { RenderRuntimeContext } from "#core/application/render-runtime.ts";
import type { FlightRenderOptions } from "./flight-renderer.tsx";

const renderSignal = MutableRef.make(Option.none<AbortSignal>());

vi.doMock(import("@vitejs/plugin-rsc/rsc/server"), () => ({
  renderToReadableStream: (_model: unknown, options?: Readonly<{ signal?: AbortSignal }>) => {
    MutableRef.set(renderSignal, Option.fromNullishOr(options?.signal));
    return new ReadableStream<Uint8Array>();
  },
}));

const { FlightRenderer } = await import("./flight-renderer.tsx");

class UnexpectedRenderRuntime extends Data.TaggedError("UnexpectedRenderRuntime") {}

const workProbe = Effect.fnUntraced(function* () {
  const started = yield* Deferred.make<boolean>();
  const interrupted = yield* Deferred.make<boolean>();
  const application = MutableRef.make(Option.none<() => Promise<never>>());
  const work = Deferred.succeed(started, true).pipe(
    Effect.andThen(Effect.never),
    Effect.onInterrupt(() => Deferred.succeed(interrupted, true)),
  );

  const renderRuntime: RenderRuntimeContext = {
    bind: (runtime, _middleware, evaluate) => {
      MutableRef.set(
        application,
        Option.some(async () => runtime(work)),
      );
      return evaluate();
    },
    run: () => {
      throw new UnexpectedRenderRuntime();
    },
  };
  const start = async (): Promise<never> => {
    const run = Option.getOrThrow(MutableRef.get(application));
    return run();
  };

  return { interrupted, renderRuntime, start, started };
});

// oxlint-disable-next-line unicorn/no-null -- React Flight's wire model uses null for unoccupied slots.
const emptySlot = null;
const renderOptions = (renderRuntime: RenderRuntimeContext): FlightRenderOptions<never> => ({
  formState: emptySlot,
  middleware: [],
  renderRuntime,
  routeTree: { child: emptySlot, content: emptySlot, id: "root" },
  serverFnResult: emptySlot,
});

const observeOutcome = async (execution: Promise<never>): Promise<string> => {
  try {
    await execution;
    return "completed";
  } catch {
    return "interrupted";
  }
};

const expectRelease = Effect.fnUntraced(function* (
  probe: Effect.Success<ReturnType<typeof workProbe>>,
  release: Effect.Effect<void>,
) {
  const outcome = observeOutcome(probe.start());
  yield* Deferred.await(probe.started);
  yield* release;
  yield* Deferred.await(probe.interrupted);
  const completed = yield* Effect.promise(async () => outcome);
  return completed;
});

it.effect("interrupts application work when its Flight render is released", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const probe = yield* workProbe();
      const renderer = yield* FlightRenderer;
      const flight = yield* renderer.render(renderOptions(probe.renderRuntime));
      const signal = Option.getOrThrow(MutableRef.get(renderSignal));
      expect(flight.signal).toBe(signal);
      expect(signal.aborted).toBe(false);

      const completed = yield* expectRelease(probe, flight.release);
      expect(completed).toBe("interrupted");
      expect(signal.aborted).toBe(true);
    }).pipe(Effect.provide(FlightRenderer.layer)),
  ),
);
