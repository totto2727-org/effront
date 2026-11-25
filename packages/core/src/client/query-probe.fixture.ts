import { assert } from "@effect/vitest";
import { Predicate } from "effect";

import type { MatchedQuery } from "./server-fn-protocol.ts";
import { matchServerFnQuery } from "./server-fn-protocol.ts";

type Arguments = Readonly<unknown[]>;
type Observer = (matched: MatchedQuery) => void;
type StreamQuery = Extract<MatchedQuery, Readonly<{ completed: unknown }>>;
const isStream = Predicate.isTagged("Stream");

export const expectStreamQuery = (matched: MatchedQuery | undefined): StreamQuery => {
  assert(isStream(matched));
  return matched;
};

export const proxy =
  <A>(
    observe: Observer,
    respond: (args: Arguments) => A | Promise<A>,
  ): ((...args: Arguments) => Promise<A>) =>
  async (...args) => {
    const matched = matchServerFnQuery(args);
    if (Predicate.isNotNullish(matched)) {
      observe(matched);
    }
    return respond(args);
  };
