"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "#check-in/effront.ts";
import { demoOrganizer } from "./data-fixtures.ts";
import { CheckInStore } from "./services.ts";

// In production, obtain this actor from verified request authentication, never from action input.
const currentOrganizer = demoOrganizer;

export const previewCheckIn = EFFRONT.ServerFn.make({
  handler: Effect.fn("previewCheckIn")(function* () {
    const store = yield* CheckInStore;
    return store.preview(currentOrganizer.id);
  }),
  input: Schema.Void,
});

export const checkInAttendee = EFFRONT.ServerFn.make({
  handler: Effect.fn("checkInAttendee")(function* ({ ticketCode }) {
    const store = yield* CheckInStore;
    return store.checkIn(currentOrganizer.id, ticketCode);
  }),
  input: Schema.Struct({ ticketCode: Schema.String }),
});
