"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront.ts";
import { Host } from "./greeting-host.ts";

export const greet = EFFRONT.ServerFn.make({
  handler: Effect.fn("greet")(function* (name) {
    const host = yield* Host;
    return `${host.greeting}, ${name}!`;
  }),
  input: Schema.String,
});
