import { describe, expect, test } from "vitest";
import { makeCheckInStore } from "./data.ts";

describe("check-in store", () => {
  test("scopes previews to the authenticated organizer", () => {
    const store = makeCheckInStore();

    expect(store.preview("organizer-ada", "event-summit")?.attendees).toHaveLength(2);
    expect(store.preview("organizer-ben", "event-summit")).toBeNull();
  });

  test("rejects an organizer trying to check in another organizer's ticket", () => {
    const store = makeCheckInStore();

    expect(store.checkIn("organizer-ada", "PRIVATE-BEN")).toStrictEqual({ status: "forbidden" });
    expect(store.preview("organizer-ben", "event-private")?.audit).toHaveLength(0);
  });

  test("creates one audit entry for repeated idempotent check-in requests", () => {
    const store = makeCheckInStore();

    expect(store.checkIn("organizer-ada", "summit-ada")).toMatchObject({
      attendeeName: "Ada Lovelace",
      status: "checked-in",
    });
    expect(store.checkIn("organizer-ada", "SUMMIT-ADA")).toMatchObject({
      attendeeName: "Ada Lovelace",
      status: "already-checked-in",
    });

    const preview = store.preview("organizer-ada");
    expect(preview?.checkedIn).toBe(1);
    expect(preview?.audit).toStrictEqual([
      {
        actorId: "organizer-ada",
        occurredAt: "2026-09-24T03:00:00.000Z",
        ticketCode: "SUMMIT-ADA",
      },
    ]);
  });

  test("validates ticket input before changing state", () => {
    const store = makeCheckInStore();

    expect(store.checkIn("organizer-ada", "bad code")).toStrictEqual({ status: "invalid-ticket" });
    expect(store.preview("organizer-ada")?.audit).toHaveLength(0);
  });
});
