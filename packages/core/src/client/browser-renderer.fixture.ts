import { Data, Effect, Fiber, Predicate } from "effect";

import type { RouteTreeModel } from "#core/rsc/route-tree.ts";
import { BrowserRenderer } from "./browser-renderer.ts";
import type { BrowserRender, BrowserRendererNavigation } from "./browser-renderer.ts";
import { renders } from "./browser-renderer-model.ts";
import type { RouteRender } from "./browser-renderer-model.ts";

class MissingPublication extends Data.TaggedError("MissingPublication")<{ message: string }> {}

type Publication = Readonly<{
  lifecycle: BrowserRendererNavigation;
  render: RouteRender;
}>;

type Discard = Readonly<{
  retired: Promise<void>;
  render: ReturnType<typeof renders.Discard>;
}>;

// oxlint-disable-next-line unicorn/no-null -- Empty React Flight route fields are serialized as null.
export const routeTree = (id: string): RouteTreeModel => ({ child: null, content: null, id });

export const waitFor = (promise: Promise<void>): Effect.Effect<void> =>
  Effect.promise(async () => promise);

export const releaseMicrotasks = Effect.promise(async () => {
  await Promise.resolve();
});

export const observe = Effect.fnUntraced(function* (promise: Promise<void>) {
  const fiber = yield* waitFor(promise).pipe(Effect.forkScoped({ startImmediately: true }));
  return {
    finished: Fiber.join(fiber),
    pending: () => Predicate.isNullish(fiber.pollUnsafe()),
  };
});

const next = <Matched extends BrowserRender>(
  queue: BrowserRender[],
  matches: Predicate.Refinement<unknown, Matched>,
): Matched => {
  const render = queue.shift();
  if (!matches(render)) {
    throw new MissingPublication({ message: "Expected the next renderer publication." });
  }
  return render;
};

export const rendererFixture = Effect.map(BrowserRenderer.make, (renderer) => {
  const queue: BrowserRender[] = [];
  renderer.initialize(routeTree("initial"), (render) => {
    queue.push(render);
  });

  const navigate = (id: string): Publication => {
    const lifecycle = renderer.navigate(routeTree(id));
    return { lifecycle, render: next(queue, renders.$is("Navigation")) };
  };
  const refresh = (id: string): Publication => {
    const lifecycle = renderer.refresh(routeTree(id));
    return { lifecycle, render: next(queue, renders.$is("Refresh")) };
  };
  const discard = ({ lifecycle }: Publication): Discard => {
    const retired = lifecycle.discard();
    return { render: next(queue, renders.$is("Discard")), retired };
  };

  return { commit: renderer.commit, discard, navigate, queue, refresh };
});
