import { resetReactClient } from "./call-server-react.fixture.ts";

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import {
  commitNewer,
  finishOlder,
  startConcurrentMutations,
} from "./call-server-concurrent.fixture.ts";

describe("concurrent server function invocations", () => {
  beforeEach(resetReactClient);

  it.effect("does not let an older response overwrite a newer response", () =>
    Effect.gen(function* () {
      const invocations = yield* startConcurrentMutations;
      expect(yield* commitNewer(invocations)).toStrictEqual({
        interrupted: 1,
        transitions: ["server-function"],
        value: "second result",
      });
      expect(yield* finishOlder(invocations)).toStrictEqual({
        refresh: ["server-function"],
        released: 1,
        rendered: ["newer"],
        value: "first result",
      });
    }).pipe(Effect.scoped),
  );
});
