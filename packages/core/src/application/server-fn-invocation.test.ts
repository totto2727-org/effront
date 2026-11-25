import { assert, describe, expect, it, test } from "@effect/vitest";
import { Effect, Predicate, Ref, Schema } from "effect";

import { Application } from "./effront.ts";
import { getEFFRONTIdentity } from "./effront-identity.ts";
import { invocationEffect } from "./server-fn.fixture.ts";
import { matchServerFnInvocation } from "./server-fn.ts";

it.effect("retains lazy execution and positional order after binding arguments", () =>
  Effect.gen(function* () {
    const values: string[] = [];
    const EFFRONT = Application.effront();
    const action = EFFRONT.ServerFn.make({
      handler: (prefix, count, suffix) =>
        Effect.sync(() => {
          const value = `${prefix}:${count}:${suffix}`;
          values.push(value);
          return value;
        }),
      input: [Schema.String, Schema.Finite, Schema.String],
    });
    const invocation = action.bind(undefined, "bound")(2, "tail");
    expect(values).toStrictEqual([]);
    const result = yield* invocationEffect(invocation, getEFFRONTIdentity(EFFRONT));
    expect(result).toBe("bound:2:tail");
    expect(values).toStrictEqual(["bound:2:tail"]);
  }),
);

it.effect("runs an omitted-input handler lazily with no arguments", () =>
  Effect.gen(function* () {
    const invoked = yield* Ref.make(false);
    const EFFRONT = Application.effront();
    const action = EFFRONT.ServerFn.make({
      handler: (...args) => Ref.set(invoked, true).pipe(Effect.as(args)),
    });
    const invocation = action();
    expect(yield* Ref.get(invoked)).toBe(false);
    const result = yield* invocationEffect(invocation, getEFFRONTIdentity(EFFRONT));
    expect(result).toStrictEqual([]);
    expect(yield* Ref.get(invoked)).toBe(true);
  }),
);

it.effect("remains lazy until the request handler executes it", () =>
  Effect.gen(function* () {
    const invoked = yield* Ref.make(false);
    const EFFRONT = Application.effront();
    const serverFn = EFFRONT.ServerFn.make({
      handler: Effect.fn("serverFn")(function* () {
        yield* Ref.set(invoked, true);
      }),
      input: Schema.Struct({ id: Schema.String }),
    });

    const invocation = serverFn({ id: "session" });
    const invokedBeforeExecution = yield* Ref.get(invoked);
    expect(invokedBeforeExecution).toBe(false);

    yield* invocationEffect(invocation, getEFFRONTIdentity(EFFRONT));
    const invokedAfterExecution = yield* Ref.get(invoked);
    expect(invokedAfterExecution).toBe(true);
  }),
);

describe("server function invocation metadata", () => {
  test("rejects an invocation owned by another EFFRONT application", () => {
    const First = Application.effront();
    const Second = Application.effront();
    const serverFn = First.ServerFn.make({
      handler: Effect.succeed,
      input: Schema.String,
    });

    const match = matchServerFnInvocation(serverFn("value"), getEFFRONTIdentity(Second));

    expect(Predicate.isTagged(match, "IdentityMismatch")).toBe(true);
  });

  test("retains the middleware scope on the native invocation metadata", () => {
    const EFFRONT = Application.effront();
    const RequireScope = EFFRONT.Middleware.make((httpEffect) => httpEffect);
    const serverFn = EFFRONT.withMiddleware(RequireScope).ServerFn.make({
      handler: Effect.succeed,
      input: Schema.String,
    });

    const match = matchServerFnInvocation(serverFn("value"), getEFFRONTIdentity(EFFRONT));

    assert(Predicate.isTagged(match, "Match"));
    expect(match.middleware).toStrictEqual([RequireScope]);
  });
});
