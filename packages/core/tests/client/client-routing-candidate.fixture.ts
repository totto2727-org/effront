import { Effect, Function, MutableRef, Option, Predicate } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";

import { BrowserRenderer } from "#core/client/browser-renderer.ts";
import {
  invokePrecommitHandler,
  makePrecommitController,
} from "./client-routing-commit.fixture.ts";
import { makeNavigationEvent } from "./client-routing-events.fixture.ts";
import type { TestNavigationApi } from "./client-routing-navigation.fixture.ts";

export const observePromise = <A>(promise: Promise<A>): Effect.Effect<A> =>
  // oxlint-disable-next-line typescript/promise-function-async -- The race tests observe the original native promise without adding another settlement turn.
  Effect.promise(() => promise);

type Gate = Readonly<{ open: () => void; promise: Promise<void>; wait: Effect.Effect<void> }>;
type Completed = Effect.Success<typeof Effect.void>;

export const makeGate = (): Gate => {
  const { promise, resolve } = Promise.withResolvers<Completed>();
  return { open: resolve, promise, wait: observePromise(promise) };
};

type Transport = Readonly<{
  aborted: Gate;
  httpClient: HttpClient.HttpClient;
  signal: () => AbortSignal | undefined;
  started: Gate;
}>;

const firstFlightChunk = 1;
export const trackFlight = (mode: "streaming" | "pending"): Transport => {
  const started = makeGate();
  const aborted = makeGate();
  const current = MutableRef.make(Option.none<AbortSignal>());
  const httpClient = HttpClient.make((request, _url, signal) =>
    Effect.sync(() => {
      MutableRef.set(current, Option.some(signal));
      const stream = new ReadableStream<Uint8Array>({
        start: (controller) => {
          if (mode === "streaming") {
            controller.enqueue(Uint8Array.of(firstFlightChunk));
          }
          started.open();
          signal.addEventListener(
            "abort",
            () => {
              controller.error(signal.reason);
              aborted.open();
            },
            { once: true },
          );
        },
      });
      const response = new Response(stream, { headers: { "content-type": "text/x-component" } });
      return HttpClientResponse.fromWeb(request, response);
    }),
  );
  return {
    aborted,
    httpClient,
    signal: () => Option.getOrUndefined(MutableRef.get(current)),
    started,
  };
};

type ControlledRenderer = Readonly<{
  allowDiscard: Gate;
  discardStarted: Gate;
  renderer: typeof BrowserRenderer.Service;
  renderStarted: Gate;
}>;

export const makeUncommittedRenderer = (): ControlledRenderer => {
  const renderStarted = makeGate();
  const renderCommitted = makeGate();
  const discardStarted = makeGate();
  const allowDiscard = makeGate();
  // oxlint-disable-next-line typescript/promise-function-async -- The caller must see the controlled discard acknowledgement itself.
  const discard = (): Promise<void> => {
    discardStarted.open();
    return allowDiscard.promise;
  };
  const renderer = BrowserRenderer.of({
    commit: Function.constVoid,
    initialize: Function.constVoid,
    navigate: () => {
      renderStarted.open();
      return { committed: renderCommitted.promise, discard, retired: Promise.resolve() };
    },
    refresh: () => {
      // oxlint-disable-next-line rules/require-tagged-error -- The native renderer must not call refresh for a navigation candidate.
      throw new TypeError("Unexpected refresh.");
    },
  });
  return { allowDiscard, discardStarted, renderStarted, renderer };
};

export const startCandidatePrecommit = Effect.fn("effront.test.startCandidatePrecommit")(function* (
  navigation: TestNavigationApi,
  signal: AbortSignal,
) {
  const pending = makeNavigationEvent({ signal });
  navigation.dispatch(pending.event);
  const handler = pending.interception()?.precommitHandler;
  if (Predicate.isNullish(handler)) {
    return yield* Effect.die("Expected a precommit handler.");
  }
  return { finished: invokePrecommitHandler(handler, makePrecommitController()) };
});
