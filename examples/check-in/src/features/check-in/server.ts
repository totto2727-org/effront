"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "../../effront";
import { demoOrganizer } from "./data";
import { CheckInStore } from "./services";

// In production, obtain this actor from verified request authentication, never from action input.
const currentOrganizer = demoOrganizer;

export const previewCheckIn = EFFRONT.ServerFn.make({
  input: Schema.Void,
  handler: Effect.fn("previewCheckIn")(function* () {
    const store = yield* CheckInStore;
    return store.preview(currentOrganizer.id);
  }),
});

export const checkInAttendee = EFFRONT.ServerFn.make({
  input: Schema.Struct({ ticketCode: Schema.String }),
  handler: Effect.fn("checkInAttendee")(function* ({ ticketCode }) {
    const store = yield* CheckInStore;
    return store.checkIn(currentOrganizer.id, ticketCode);
  }),
});
