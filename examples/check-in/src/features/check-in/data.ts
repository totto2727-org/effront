export type Organizer = {
  readonly id: string;
  readonly name: string;
};

export type EventPreview = {
  readonly eventId: string;
  readonly eventName: string;
  readonly organizerName: string;
  readonly checkedIn: number;
  readonly total: number;
  readonly attendees: ReadonlyArray<{
    readonly ticketCode: string;
    readonly attendeeName: string;
    readonly status: "ready" | "checked-in";
  }>;
  readonly audit: ReadonlyArray<{
    readonly ticketCode: string;
    readonly actorId: string;
    readonly occurredAt: string;
  }>;
};

export type CheckInResult =
  | { readonly status: "checked-in"; readonly attendeeName: string; readonly occurredAt: string }
  | {
      readonly status: "already-checked-in";
      readonly attendeeName: string;
      readonly occurredAt: string;
    }
  | { readonly status: "invalid-ticket" }
  | { readonly status: "not-found" }
  | { readonly status: "forbidden" };

type Ticket = {
  readonly id: string;
  readonly eventId: string;
  readonly code: string;
  readonly attendeeName: string;
  checkedInAt: string | null;
};

type AuditEntry = {
  readonly ticketId: string;
  readonly actorId: string;
  readonly occurredAt: string;
};

const fixedNow = "2026-09-24T03:00:00.000Z";

/**
 * An intentionally process-local store for the example. Its synchronous transition is atomic
 * in one Node event-loop turn and inserts its audit record in the same operation. It is reset
 * whenever the host restarts and must be replaced by a database transaction in a real service.
 */
export function makeCheckInStore() {
  const organizers: ReadonlyArray<Organizer> = [
    { id: "organizer-ada", name: "Ada Organizer" },
    { id: "organizer-ben", name: "Ben Organizer" },
  ];
  const events = [
    { id: "event-summit", name: "Node Summit", organizerId: "organizer-ada" },
    { id: "event-private", name: "Private Workshop", organizerId: "organizer-ben" },
  ] as const;
  const tickets: Ticket[] = [
    {
      id: "ticket-ada",
      eventId: "event-summit",
      code: "SUMMIT-ADA",
      attendeeName: "Ada Lovelace",
      checkedInAt: null,
    },
    {
      id: "ticket-grace",
      eventId: "event-summit",
      code: "SUMMIT-GRACE",
      attendeeName: "Grace Hopper",
      checkedInAt: null,
    },
    {
      id: "ticket-ben",
      eventId: "event-private",
      code: "PRIVATE-BEN",
      attendeeName: "Ben Bitdiddle",
      checkedInAt: null,
    },
  ];
  const audit: AuditEntry[] = [];

  function preview(organizerId: string, eventId = "event-summit"): EventPreview | null {
    const event = events.find(
      (candidate) => candidate.id === eventId && candidate.organizerId === organizerId,
    );
    if (!event) return null;

    const organizer = organizers.find((candidate) => candidate.id === organizerId);
    if (!organizer) return null;

    const eventTickets = tickets.filter((ticket) => ticket.eventId === event.id);
    return {
      eventId: event.id,
      eventName: event.name,
      organizerName: organizer.name,
      checkedIn: eventTickets.filter((ticket) => ticket.checkedInAt !== null).length,
      total: eventTickets.length,
      attendees: eventTickets.map((ticket) => ({
        ticketCode: ticket.code,
        attendeeName: ticket.attendeeName,
        status: ticket.checkedInAt === null ? "ready" : "checked-in",
      })),
      audit: audit
        .filter((entry) => eventTickets.some((ticket) => ticket.id === entry.ticketId))
        .map((entry) => ({
          ticketCode:
            eventTickets.find((ticket) => ticket.id === entry.ticketId)?.code ?? "unknown",
          actorId: entry.actorId,
          occurredAt: entry.occurredAt,
        })),
    };
  }

  function checkIn(organizerId: string, ticketCode: string): CheckInResult {
    const code = ticketCode.trim().toUpperCase();
    if (!/^[A-Z0-9]+-[A-Z0-9]+$/.test(code)) return { status: "invalid-ticket" };

    const ticket = tickets.find((candidate) => candidate.code === code);
    if (!ticket) return { status: "not-found" };

    const event = events.find((candidate) => candidate.id === ticket.eventId);
    if (!event || event.organizerId !== organizerId) return { status: "forbidden" };

    if (ticket.checkedInAt !== null) {
      return {
        status: "already-checked-in",
        attendeeName: ticket.attendeeName,
        occurredAt: ticket.checkedInAt,
      };
    }

    // This guarded write and audit append are one synchronous, non-awaiting transition.
    ticket.checkedInAt = fixedNow;
    audit.push({ ticketId: ticket.id, actorId: organizerId, occurredAt: fixedNow });
    return { status: "checked-in", attendeeName: ticket.attendeeName, occurredAt: fixedNow };
  }

  return { preview, checkIn };
}

export const checkInStore = makeCheckInStore();
export const demoOrganizer = { id: "organizer-ada", name: "Ada Organizer" } as const;
