import { Effect, Layer, MutableRef } from "effect";
import { vi } from "vitest";

import { BrowserEffectRunner } from "#core/client/browser-effect-runner.ts";
import { BrowserRenderer } from "#core/client/browser-renderer.ts";
import type { BrowserRender } from "#core/client/browser-renderer.ts";
import { FlightClient } from "#core/client/flight-client.ts";
import { RouteRefresher } from "#core/client/route-refresh.ts";
import { makeFlight, makeRouteTree } from "./call-server-mutation.fixture.ts";
import { invokeServerFn } from "./call-server-react.fixture.ts";
import {
  listen,
  navigationFor,
  routeLoaderFor,
  withoutNetwork,
} from "./call-server-service.fixture.ts";
import { observePromise } from "./client-routing-candidate.fixture.ts";

const captureBrowserRenders = Effect.gen(function* () {
  const renderer = yield* BrowserRenderer.make;
  const publication = MutableRef.make(Promise.withResolvers<BrowserRender>());
  renderer.initialize(makeRouteTree("initial"), (render) => {
    MutableRef.get(publication).resolve(render);
  });
  return {
    read: (): Effect.Effect<BrowserRender> => observePromise(MutableRef.get(publication).promise),
    renderer,
    reset: (): void => {
      MutableRef.set(publication, Promise.withResolvers<BrowserRender>());
    },
  };
});

export const openSubmittedRoute = Effect.fnUntraced(function* (completed: Effect.Effect<void>) {
  const publication = yield* captureBrowserRenders;
  const released = vi.fn<() => void>();
  const cached = vi.fn<() => void>();
  const resource = { ...makeFlight("refreshed", "saved", Effect.sync(released)), completed };
  const dependencies = Layer.mergeAll(
    BrowserEffectRunner.layer,
    BrowserRenderer.layerTest(publication.renderer),
    FlightClient.layerTest({ load: () => Effect.succeed(resource) }),
    navigationFor(),
    routeLoaderFor(() => cached),
    RouteRefresher.layerTest({ interruptCurrentRouteRefresh: Effect.void }),
  );
  yield* listen(dependencies).pipe(Effect.provide(withoutNetwork));
  const value = yield* observePromise(invokeServerFn("save"));
  const refresh = yield* publication.read();
  return { cached, publication, refresh, released, value };
});

type SubmittedRoute = Effect.Success<ReturnType<typeof openSubmittedRoute>>;
type Publication = SubmittedRoute["publication"];

export const prepareReplacement = Effect.fnUntraced(function* (
  publication: Publication,
  kind: "navigation" | "refresh",
) {
  publication.reset();
  const tree = makeRouteTree("replacement");
  const { renderer } = publication;
  const replacement = kind === "navigation" ? renderer.navigate(tree) : renderer.refresh(tree);
  const render = yield* publication.read();
  yield* Effect.yieldNow;
  return { render, replacement };
});

export const commitReplacement = Effect.fnUntraced(function* (
  { renderer }: Publication,
  { render, replacement }: Effect.Success<ReturnType<typeof prepareReplacement>>,
) {
  renderer.commit(render);
  yield* observePromise(replacement.committed);
  yield* Effect.yieldNow;
});

export const lifecycle = ({
  cached,
  released,
}: SubmittedRoute): Readonly<{
  cached: number;
  released: number;
}> => ({ cached: cached.mock.calls.length, released: released.mock.calls.length });
