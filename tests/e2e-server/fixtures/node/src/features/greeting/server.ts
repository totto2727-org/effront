"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "#fixture/effront.ts";
import { Host } from "./services.ts";

export const greet = EFFRONT.ServerFn.make({
  handler: Effect.fn("greet")(function* (name) {
    const host = yield* Host;
    return `${host.greeting}, ${name}!`;
  }),
  input: Schema.String,
});
