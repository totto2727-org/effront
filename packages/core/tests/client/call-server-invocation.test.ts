import { invokeServerFn, resetReactClient } from "./call-server-react.fixture.ts";

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { encodeReply } from "@vitejs/plugin-rsc/browser";
import { Effect, Exit, Option, Predicate } from "effect";
import { vi } from "vitest";

import { FlightClient } from "#core/client/flight-client.ts";
import { flightResources } from "#core/client/flight-client-model.ts";
import { firstEntry, listenIdle } from "./call-server-service.fixture.ts";
import { makeGate, observePromise } from "./client-routing-candidate.fixture.ts";

type Encoder = typeof encodeReply;
type EncoderOptions = Parameters<Encoder>[1];

// oxlint-disable-next-line typescript/promise-function-async -- The fixture rejects the exact encoding promise on browser abort.
const pendingEncoding = (signal: AbortSignal, onAbort: () => void): Promise<string> => {
  const encoding = Promise.withResolvers<string>();
  signal.addEventListener(
    "abort",
    () => {
      onAbort();
      encoding.reject(new DOMException("Encoding aborted", "AbortError"));
    },
    { once: true },
  );
  return encoding.promise;
};

const interruptedEncoding = Effect.sync(() => {
  const started = Promise.withResolvers<AbortSignal>();
  const aborted = makeGate();
  // oxlint-disable-next-line typescript/promise-function-async -- Pass the exact held encoding promise and its abort to the React caller.
  const encode = (_args: unknown, options: EncoderOptions): Promise<string> => {
    const signal = Option.getOrThrow(Option.fromNullishOr(options?.signal));
    started.resolve(signal);
    return pendingEncoding(signal, aborted.open);
  };
  vi.mocked(encodeReply).mockImplementationOnce(encode);
  return { aborted, started };
});

const observesRejection = async (call: Promise<unknown>): Promise<boolean> => {
  try {
    await call;
    return false;
  } catch (error) {
    return Predicate.isError(error);
  }
};

const openEncoding = Effect.gen(function* () {
  const { aborted, started } = yield* interruptedEncoding;
  const load = vi.fn<FlightClient["Service"]["load"]>(() =>
    Effect.die("Unexpected Flight load before argument encoding."),
  );
  yield* listenIdle(FlightClient.layerTest({ load }));
  const result = invokeServerFn("cancelled");
  const rejected = observesRejection(result);
  const signal = yield* observePromise(started.promise);
  return { aborted, load, rejected, signal };
});

// oxlint-disable-next-line unicorn/no-null -- A native Flight payload uses null for a missing result, form state, or route content.
const absent = null;

const incompleteFlight = (
  release: Effect.Effect<void>,
): ReturnType<typeof flightResources.Flight> =>
  flightResources.Flight({
    completed: Effect.void,
    payload: {
      formState: absent,
      routeTree: { child: absent, content: absent, id: "incomplete" },
      serverFnResult: absent,
    },
    release,
    resolvedUrl: new URL(firstEntry.url),
  });

describe("server function invocation", () => {
  beforeEach(resetReactClient);

  it.effect("aborts argument encoding when the invocation is cancelled", () =>
    Effect.gen(function* () {
      const encoding = yield* openEncoding.pipe(
        Effect.tap(({ signal }) =>
          Effect.sync(() => {
            expect(signal).toBeInstanceOf(AbortSignal);
            expect(signal.aborted).toBe(false);
          }),
        ),
        Effect.scoped,
      );
      yield* encoding.aborted.wait;
      expect(encoding.signal.aborted).toBe(true);
      expect(yield* observePromise(encoding.rejected)).toBe(true);
      expect(encoding.load).not.toHaveBeenCalled();
    }),
  );

  it.effect("releases an incomplete response", () =>
    Effect.gen(function* () {
      const released = vi.fn<() => void>();
      const response = incompleteFlight(Effect.sync(released));
      const flight = FlightClient.layerTest({
        load: () => Effect.succeed(response),
        loadInitial: Effect.die("Unexpected initial Flight load."),
      });
      yield* listenIdle(flight);
      const result = invokeServerFn("incomplete");
      const exit = yield* Effect.exit(observePromise(result));
      expect(Exit.isFailure(exit)).toBe(true);
      expect(released).toHaveBeenCalledOnce();
    }).pipe(Effect.scoped),
  );
});
