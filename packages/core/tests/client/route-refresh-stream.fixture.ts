import { Deferred, Effect, Function, Queue } from "effect";
import { vi } from "vitest";

import { BrowserRenderer } from "#core/client/browser-renderer.ts";
import type { BrowserRender } from "#core/client/browser-renderer.ts";

import { loaderFor, makeRouteTree, route } from "./route-refresh-browser.fixture.ts";
import { entry } from "./route-refresh-navigation.fixture.ts";

type Signal = Deferred.Deferred<boolean>;
export const signal = (event: Signal): Effect.Effect<boolean> => Deferred.succeed(event, true);
export const makeSignal = Deferred.make<boolean>;

export const streamRefresh = Effect.gen(function* () {
  const finished = yield* makeSignal();
  const released = yield* makeSignal();
  const scopeClosed = yield* makeSignal();
  const release = vi.fn<() => void>();
  const cached = vi.fn<() => void>();
  const tree = makeRouteTree("refreshed");
  const releaseStream = Effect.sync(release).pipe(Effect.andThen(signal(released)), Effect.asVoid);
  const response = route({
    cache: Function.constVoid,
    completed: Deferred.await(finished).pipe(Effect.asVoid),
    release: releaseStream,
    resolvedUrl: new URL(entry.url),
    routeTree: tree,
  });
  const load = Effect.acquireRelease(Effect.succeed(response), () => signal(scopeClosed));
  return {
    cached,
    finished,
    loader: loaderFor(() => load, Function.constVoid, cached),
    release,
    released,
    scopeClosed,
    tree,
  };
});

export type StreamingRefresh = Effect.Success<typeof streamRefresh>;

export const queuedRenderer = Effect.fnUntraced(function* (
  observe: (render: BrowserRender) => boolean = Function.constTrue,
) {
  const browserRenderer = yield* BrowserRenderer.make;
  const queue = yield* Queue.unbounded<BrowserRender>();
  const initial = makeRouteTree("initial");
  browserRenderer.initialize(initial, (render) => {
    if (observe(render)) {
      Queue.offerUnsafe(queue, render);
    }
  });
  return { browserRenderer, initial, next: Queue.take(queue) };
});
