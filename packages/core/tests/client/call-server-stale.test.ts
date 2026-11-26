import { resetReactClient } from "./call-server-react.fixture.ts";

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, MutableRef } from "effect";

import { firstEntry, secondEntry } from "./call-server-service.fixture.ts";
import { observeStaleResponse } from "./call-server-stale.fixture.ts";
import type { StaleNavigation } from "./call-server-stale.fixture.ts";

const moveToSecondEntry = ({ currentEntry }: StaleNavigation): void => {
  MutableRef.set(currentEntry, secondEntry);
};

type TransitionCompleted = Effect.Success<typeof Effect.void>;
const holdNavigation = ({ transition }: StaleNavigation): void => {
  MutableRef.set(transition, {
    committed: Promise.resolve(),
    finished: Promise.withResolvers<TransitionCompleted>().promise,
    from: firstEntry,
    navigationType: "push",
  });
};

const refreshed = {
  recorded: ["server-function"],
  released: 1,
  rendered: 0,
  value: "first result",
};

describe("stale server function Flight responses", () => {
  beforeEach(resetReactClient);

  it.effect("refreshes the current route instead of applying a response from another entry", () =>
    Effect.gen(function* () {
      const outcome = yield* observeStaleResponse(moveToSecondEntry);
      expect(outcome).toStrictEqual(refreshed);
    }).pipe(Effect.scoped),
  );

  it.effect("rechecks the entry after awaiting older refresh cleanup", () =>
    Effect.gen(function* () {
      const outcome = yield* observeStaleResponse(moveToSecondEntry, "DuringInterruption");
      expect(outcome).toStrictEqual(refreshed);
    }).pipe(Effect.scoped),
  );

  it.effect("does not apply a response while native navigation is in progress", () =>
    Effect.gen(function* () {
      const outcome = yield* observeStaleResponse(holdNavigation);
      expect(outcome).toStrictEqual(refreshed);
    }).pipe(Effect.scoped),
  );
});
