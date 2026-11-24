import { expect, it } from "@effect/vitest";
import { Effect } from "effect";

import {
  observe,
  releaseMicrotasks,
  rendererFixture,
  waitFor,
} from "./browser-renderer.fixture.ts";

const queuedRefreshes = Effect.gen(function* () {
  const fixture = yield* rendererFixture;
  const first = fixture.refresh("first");
  const second = fixture.refresh("second");
  const third = fixture.refresh("third");
  const observed = yield* Effect.all({
    firstCommitted: observe(first.lifecycle.committed),
    firstRetired: observe(first.lifecycle.retired),
    secondRetired: observe(second.lifecycle.retired),
    thirdRetired: observe(third.lifecycle.retired),
  });
  return { fixture, observed, second, third };
});

it.effect("retires skipped refreshes only up to the render React commits", () =>
  Effect.gen(function* () {
    const { fixture, observed, second, third } = yield* queuedRefreshes;
    yield* releaseMicrotasks;
    expect(observed.firstRetired.pending()).toBe(true);

    // React skips the first refresh while the third is still preparing.
    fixture.commit(second.render);
    yield* Effect.all([observed.firstRetired.finished, waitFor(second.lifecycle.committed)]);
    expect([
      observed.firstCommitted.pending(),
      observed.secondRetired.pending(),
      observed.thirdRetired.pending(),
    ]).toStrictEqual([true, true, true]);

    // React may repeat a layout effect for the same commit.
    fixture.commit(second.render);
    fixture.commit(third.render);
    yield* Effect.all([observed.secondRetired.finished, waitFor(third.lifecycle.committed)]);
    expect(observed.thirdRetired.pending()).toBe(true);
  }),
);

it.effect("acknowledges a discard that React skips when committing a replacement", () =>
  Effect.gen(function* () {
    const fixture = yield* rendererFixture;
    const first = fixture.refresh("first");
    const discard = fixture.discard(first);
    const discarded = yield* observe(discard.retired);
    const second = fixture.refresh("second");
    yield* releaseMicrotasks;
    expect(discarded.pending()).toBe(true);
    fixture.commit(second.render);
    yield* Effect.all([discarded.finished, waitFor(second.lifecycle.committed)]);
  }),
);

it.effect("uses discard publication order when retiring skipped renders", () =>
  Effect.gen(function* () {
    const fixture = yield* rendererFixture;
    const first = fixture.refresh("first");
    const second = fixture.refresh("second");
    const discard = fixture.discard(first);
    const third = fixture.refresh("third");
    const thirdRetirement = yield* observe(third.lifecycle.retired);

    // This discard was published after the second refresh but before the third.
    fixture.commit(discard.render);
    yield* Effect.all([waitFor(discard.retired), waitFor(second.lifecycle.retired)]);
    expect(thirdRetirement.pending()).toBe(true);
  }),
);

it.effect(
  "does not republish a skipped navigation when cancellation arrives after retirement",
  () =>
    Effect.gen(function* () {
      const fixture = yield* rendererFixture;
      const navigation = fixture.navigate("destination");
      const refresh = fixture.refresh("refreshed");
      fixture.commit(refresh.render);
      yield* waitFor(refresh.lifecycle.committed);

      expect(navigation.lifecycle.discard()).toBe(navigation.lifecycle.retired);
      expect(fixture.queue).toStrictEqual([]);
    }),
);

const queuedDiscard = Effect.gen(function* () {
  const fixture = yield* rendererFixture;
  const visible = fixture.refresh("visible");
  fixture.commit(visible.render);
  const visibleRetirement = yield* observe(visible.lifecycle.retired);
  const candidate = fixture.refresh("candidate");
  const discard = fixture.discard(candidate);
  return { candidate, discard, fixture, visibleRetirement };
});

it.effect("keeps a tree alive while a queued discard can restore it", () =>
  Effect.gen(function* () {
    const { candidate, discard, fixture, visibleRetirement } = yield* queuedDiscard;
    // The lower-priority discard still needs the visible tree to restore that page.
    fixture.commit(candidate.render);
    yield* waitFor(candidate.lifecycle.committed);
    expect(visibleRetirement.pending()).toBe(true);

    fixture.commit(discard.render);
    yield* waitFor(discard.retired);
    expect(visibleRetirement.pending()).toBe(true);

    const replacement = fixture.refresh("replacement");
    fixture.commit(replacement.render);
    yield* Effect.all([visibleRetirement.finished, waitFor(replacement.lifecycle.committed)]);
  }),
);

it.effect("releases a retained tree when React skips the discard that would restore it", () =>
  Effect.gen(function* () {
    const { candidate, discard, fixture, visibleRetirement } = yield* queuedDiscard;
    fixture.commit(candidate.render);
    yield* waitFor(candidate.lifecycle.committed);
    expect(visibleRetirement.pending()).toBe(true);

    // A newer replacement overtakes the discard so neither older tree can return.
    const replacement = fixture.refresh("replacement");
    fixture.commit(replacement.render);
    yield* Effect.all([
      visibleRetirement.finished,
      waitFor(discard.retired),
      waitFor(replacement.lifecycle.committed),
    ]);
  }),
);
