import { resetReactClient } from "./call-server-react.fixture.ts";

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Predicate } from "effect";

import {
  commitReplacement,
  lifecycle,
  openSubmittedRoute,
  prepareReplacement,
} from "./call-server-renderer.fixture.ts";

const isRefresh = Predicate.isTagged("Refresh");

describe("server function refresh renderer ownership", () => {
  beforeEach(resetReactClient);

  it.effect("releases a visible mutation refresh when its replacement commits", () =>
    Effect.gen(function* () {
      const submitted = yield* openSubmittedRoute(Effect.never);
      expect(submitted.value).toBe("saved");
      submitted.publication.renderer.commit(submitted.refresh);

      // The visible page keeps streaming until the replacement commits.
      const replacement = yield* prepareReplacement(submitted.publication, "navigation");
      expect(submitted.released).not.toHaveBeenCalled();
      yield* commitReplacement(submitted.publication, replacement);
      expect(lifecycle(submitted)).toStrictEqual({ cached: 0, released: 1 });
    }).pipe(Effect.scoped),
  );

  it.effect("releases a never-committed mutation refresh after its successor commits", () =>
    Effect.gen(function* () {
      const submitted = yield* openSubmittedRoute(Effect.void);
      expect({ refresh: isRefresh(submitted.refresh), value: submitted.value }).toStrictEqual({
        refresh: true,
        value: "saved",
      });

      // The first response reached EOF before its refresh committed.
      const replacement = yield* prepareReplacement(submitted.publication, "refresh");
      expect(submitted.released).not.toHaveBeenCalled();
      yield* commitReplacement(submitted.publication, replacement);
      expect(lifecycle(submitted)).toStrictEqual({ cached: 0, released: 1 });
    }).pipe(Effect.scoped),
  );
});
