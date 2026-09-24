import { describe, expect, it } from "vitest";
import { CheckInStore } from "./data";

describe("CheckInStore", () => {
  it("scopes previews to the authenticated organizer", () => {
    const store = new CheckInStore();

    expect(store.preview("organizer-ada", "event-summit")?.attendees).toHaveLength(2);
    expect(store.preview("organizer-ben", "event-summit")).toBeNull();
  });

  it("rejects an organizer trying to check in another organizer's ticket", () => {
    const store = new CheckInStore();

    expect(store.checkIn("organizer-ada", "PRIVATE-BEN")).toEqual({ status: "forbidden" });
    expect(store.preview("organizer-ben", "event-private")?.audit).toHaveLength(0);
  });

  it("creates one audit entry for repeated idempotent check-in requests", () => {
    const store = new CheckInStore();

    expect(store.checkIn("organizer-ada", "summit-ada")).toMatchObject({
      status: "checked-in",
      attendeeName: "Ada Lovelace",
    });
    expect(store.checkIn("organizer-ada", "SUMMIT-ADA")).toMatchObject({
      status: "already-checked-in",
      attendeeName: "Ada Lovelace",
    });

    const preview = store.preview("organizer-ada");
    expect(preview?.checkedIn).toBe(1);
    expect(preview?.audit).toEqual([
      {
        ticketCode: "SUMMIT-ADA",
        actorId: "organizer-ada",
        occurredAt: "2026-09-24T03:00:00.000Z",
      },
    ]);
  });

  it("validates ticket input before changing state", () => {
    const store = new CheckInStore();

    expect(store.checkIn("organizer-ada", "bad code")).toEqual({ status: "invalid-ticket" });
    expect(store.preview("organizer-ada")?.audit).toHaveLength(0);
  });
});
