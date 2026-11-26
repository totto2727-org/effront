import { expect, it } from "@effect/vitest";
import { Effect, Function } from "effect";
import { vi } from "vitest";

import { BrowserRenderer } from "./browser-renderer.ts";
import {
  observe,
  releaseMicrotasks,
  rendererFixture,
  routeTree,
  waitFor,
} from "./browser-renderer.fixture.ts";

it.effect("initializes once for a React root", () =>
  Effect.gen(function* () {
    const renderer = yield* BrowserRenderer.make;
    const initial = routeTree("initial");
    expect(() => renderer.navigate(routeTree("destination"))).toThrow(
      "BrowserRenderer must be initialized by ReactDOMRenderer.",
    );
    renderer.initialize(initial, Function.constVoid);
    renderer.initialize(initial, Function.constVoid);
    expect(() => {
      renderer.initialize(initial, vi.fn<() => void>());
    }).toThrow("BrowserRenderer cannot be initialized by more than one React root.");
  }),
);

const committedNavigation = Effect.gen(function* () {
  const fixture = yield* rendererFixture;
  const navigation = fixture.navigate("destination");
  fixture.commit(navigation.render);
  yield* waitFor(navigation.lifecycle.committed);
  return { fixture, navigation };
});

it.effect("waits for retirement when a navigation is discarded after commit", () =>
  Effect.gen(function* () {
    const { fixture, navigation } = yield* committedNavigation;
    const retirement = navigation.lifecycle.discard();
    const observed = yield* observe(retirement);
    expect(navigation.lifecycle.discard()).toBe(retirement);
    expect(fixture.queue).toStrictEqual([]);
    const successor = fixture.navigate("successor");
    yield* releaseMicrotasks;
    expect(observed.pending()).toBe(true);
    fixture.commit(successor.render);
    yield* observed.finished;
  }),
);

it.effect("retires a navigation only after its successor becomes visible", () =>
  Effect.gen(function* () {
    const { fixture, navigation } = yield* committedNavigation;
    const second = fixture.navigate("second");
    const retirement = yield* observe(navigation.lifecycle.retired);
    expect(fixture.queue).toStrictEqual([]);
    yield* releaseMicrotasks;
    expect(retirement.pending()).toBe(true);
    fixture.commit(second.render);
    yield* retirement.finished;
    expect(fixture.queue).toStrictEqual([]);
  }),
);

it.effect("retires a visible navigation when a refresh commits", () =>
  Effect.gen(function* () {
    const fixture = yield* rendererFixture;
    const navigation = fixture.navigate("destination");
    fixture.commit(navigation.render);
    const refresh = fixture.refresh("refreshed");
    const retirement = yield* observe(navigation.lifecycle.retired);
    yield* releaseMicrotasks;
    expect(retirement.pending()).toBe(true);
    fixture.commit(refresh.render);
    yield* Effect.all([retirement.finished, waitFor(refresh.lifecycle.committed)]);
  }),
);

const visibleWithScheduledDiscard = Effect.gen(function* () {
  const fixture = yield* rendererFixture;
  const visible = fixture.navigate("visible");
  fixture.commit(visible.render);
  const candidate = fixture.navigate("candidate");
  const discard = fixture.discard(candidate);
  return { candidate, discard, fixture, visible };
});

it.effect("discards a scheduled navigation without replacing the visible navigation", () =>
  Effect.gen(function* () {
    const { candidate, discard, fixture, visible } = yield* visibleWithScheduledDiscard;
    const candidateRetirement = yield* observe(candidate.lifecycle.retired);
    const visibleRetirement = yield* observe(visible.lifecycle.retired);
    expect(discard.render.restore.routeTree).toBe(visible.render.routeTree);
    yield* releaseMicrotasks;
    expect(candidateRetirement.pending()).toBe(true);
    fixture.commit(discard.render);
    yield* candidateRetirement.finished;
    expect({
      pending: visibleRetirement.pending(),
      queued: fixture.queue,
    }).toStrictEqual({ pending: true, queued: [] });
    expect(candidate.lifecycle.discard()).toBe(discard.retired);
  }),
);

it.effect("restores the last committed navigation tree on the next discard", () =>
  Effect.gen(function* () {
    const fixture = yield* rendererFixture;
    const first = fixture.navigate("first");
    fixture.commit(first.render);
    const second = fixture.navigate("second");
    const discard = fixture.discard(second);
    expect(discard.render.restore.routeTree).toBe(first.render.routeTree);
    fixture.commit(discard.render);
    yield* waitFor(discard.retired);
  }),
);

it.effect("uses a committed Server Function refresh as the next discard target", () =>
  Effect.gen(function* () {
    const fixture = yield* rendererFixture;
    const refresh = fixture.refresh("refreshed");
    fixture.commit(refresh.render);
    yield* waitFor(refresh.lifecycle.committed);
    const navigation = fixture.navigate("destination");
    const discard = fixture.discard(navigation);
    expect(discard.render.restore.routeTree).toBe(refresh.render.routeTree);
    fixture.commit(discard.render);
    yield* waitFor(discard.retired);
  }),
);

const otherRootPublication = Effect.gen(function* () {
  const fixture = yield* rendererFixture;
  const other = yield* rendererFixture;
  const visible = fixture.refresh("visible");
  fixture.commit(visible.render);
  const observed = yield* observe(visible.lifecycle.retired);
  const foreign = other.refresh("foreign");
  return { fixture, foreign, observed, visible };
});

it.effect("rejects another root's publication before changing the visible tree", () =>
  Effect.gen(function* () {
    const { fixture, foreign, observed, visible } = yield* otherRootPublication;
    expect(() => {
      fixture.commit(foreign.render);
    }).toThrow("Browser render does not belong to this root.");
    const candidate = fixture.navigate("candidate");
    const discard = fixture.discard(candidate);
    expect(discard.render.restore.routeTree).toBe(visible.render.routeTree);
    fixture.commit(discard.render);
    yield* waitFor(discard.retired);
    expect(observed.pending()).toBe(true);
  }),
);

const commitRefresh = Effect.fnUntraced(function* (
  fixture: Effect.Success<typeof rendererFixture>,
  id: string,
) {
  const replacement = fixture.refresh(id);
  fixture.commit(replacement.render);
  yield* waitFor(replacement.lifecycle.committed);
});

it.effect("rejects an older commit without retiring the current tree", () =>
  Effect.gen(function* () {
    const fixture = yield* rendererFixture;
    const skipped = fixture.refresh("skipped");
    const current = fixture.refresh("current");
    fixture.commit(current.render);
    const retirement = yield* observe(current.lifecycle.retired);
    expect(() => {
      fixture.commit(skipped.render);
    }).toThrow("Browser renders must commit in publication order.");
    yield* waitFor(current.lifecycle.committed);
    expect(retirement.pending()).toBe(true);
    yield* commitRefresh(fixture, "replacement");
    yield* retirement.finished;
  }),
);
