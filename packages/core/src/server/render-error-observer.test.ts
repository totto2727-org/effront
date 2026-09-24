import { expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { RenderErrorObserver } from "../http";

it.effect("is optional and does not retain another request's observer", () =>
  Effect.gen(function* () {
    expect(yield* RenderErrorObserver).toBeUndefined();
    const observer = () => undefined;
    expect(
      yield* RenderErrorObserver.pipe(Effect.provideService(RenderErrorObserver, observer)),
    ).toBe(observer);
    expect(yield* RenderErrorObserver).toBeUndefined();
  }),
);
