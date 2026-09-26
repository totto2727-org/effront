"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "../../effront";
import { checkInStore, demoOrganizer } from "./data";

// In production, obtain this actor from verified request authentication, never from action input.
const currentOrganizer = demoOrganizer;

export const previewCheckIn = EFFRONT.ServerFn.make({
  input: Schema.Void,
  handler: Effect.fn("previewCheckIn")(() =>
    Effect.sync(() => checkInStore.preview(currentOrganizer.id)),
  ),
});

export const checkInAttendee = EFFRONT.ServerFn.make({
  input: Schema.Struct({ ticketCode: Schema.String }),
  handler: Effect.fn("checkInAttendee")(({ ticketCode }) =>
    Effect.sync(() => checkInStore.checkIn(currentOrganizer.id, ticketCode)),
  ),
});
