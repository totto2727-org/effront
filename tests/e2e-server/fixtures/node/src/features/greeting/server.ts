"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "../../effront";
import { Host } from "./services";

export const greet = EFFRONT.ServerFn.make({
  input: Schema.String,
  handler: Effect.fn("greet")(function* (name) {
    const host = yield* Host;
    return `${host.greeting}, ${name}!`;
  }),
});
