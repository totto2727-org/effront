import { assert } from "@effect/vitest";
import { Effect, Predicate } from "effect";

import type { ServerFnInputError } from "#core/rsc/server-fn-error.ts";
import type { EFFRONTIdentity } from "./effront-identity.ts";
import type { ServerFnOperationError } from "./server-fn.ts";
import { matchServerFnInvocation } from "./server-fn.ts";

export const invocationEffect = <Services>(
  invocation: unknown,
  identity: EFFRONTIdentity<Services>,
): Effect.Effect<unknown, ServerFnInputError | ServerFnOperationError, Services> => {
  const match = matchServerFnInvocation(invocation, identity);
  if (!Predicate.isTagged(match, "Match")) {
    return Effect.die("Expected an EFFRONT ServerFn invocation.");
  }
  return match.effect;
};

export const nativeInvocation = (
  action: (...args: never[]) => Promise<unknown>,
  args: Readonly<unknown[]>,
): unknown => {
  // Call with untrusted native arguments, bypassing the public TypeScript signature.
  const result: unknown = Reflect.apply(action, undefined, args);
  assert(result instanceof Promise);
  return result;
};
