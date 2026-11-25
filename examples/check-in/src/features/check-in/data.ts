import { Predicate } from "effect";
import type { Event, Ticket } from "./data-fixtures.ts";
import { events, organizers, tickets } from "./data-fixtures.ts";

export type EventPreview = Readonly<{
  attendees: Readonly<
    Readonly<{
      attendeeName: string;
      status: "ready" | "checked-in";
      ticketCode: string;
    }>[]
  >;
  audit: Readonly<
    Readonly<{
      actorId: string;
      occurredAt: string;
      ticketCode: string;
    }>[]
  >;
  checkedIn: number;
  eventId: string;
  eventName: string;
  organizerName: string;
  total: number;
}>;

export type CheckInResult =
  | Readonly<{ attendeeName: string; occurredAt: string; status: "checked-in" }>
  | Readonly<{ attendeeName: string; occurredAt: string; status: "already-checked-in" }>
  | Readonly<{ status: "invalid-ticket" }>
  | Readonly<{ status: "not-found" }>
  | Readonly<{ status: "forbidden" }>;

type AuditEntry = Readonly<{
  actorId: string;
  occurredAt: string;
  ticketId: string;
}>;

type State = Readonly<{
  audit: AuditEntry[];
  times: Map<string, string>;
}>;

type CheckInStore = Readonly<{
  checkIn: (organizerId: string, ticketCode: string) => CheckInResult;
  preview: (organizerId: string, eventId?: string) => EventPreview | null;
}>;

const fixedNow = "2026-09-24T03:00:00.000Z";
const ticketPattern = /^[A-Z0-9]+-[A-Z0-9]+$/u;
// oxlint-disable-next-line unicorn/no-null -- The preview Server Function exposes null for an inaccessible event.
const missingPreview = null;

const previewAudit = (
  audit: State["audit"],
  eventTickets: Readonly<Ticket[]>,
): EventPreview["audit"] =>
  audit.flatMap((entry) => {
    const ticket = eventTickets.find((candidate) => candidate.id === entry.ticketId);
    if (Predicate.isNullish(ticket)) {
      return [];
    }
    return [
      {
        actorId: entry.actorId,
        occurredAt: entry.occurredAt,
        ticketCode: ticket.code,
      },
    ];
  });

const previewEvent = (state: State, event: Event, organizerName: string): EventPreview => {
  const eventTickets = tickets.filter((ticket) => ticket.eventId === event.id);
  return {
    attendees: eventTickets.map((ticket) => ({
      attendeeName: ticket.attendeeName,
      status: state.times.has(ticket.id) ? "checked-in" : "ready",
      ticketCode: ticket.code,
    })),
    audit: previewAudit(state.audit, eventTickets),
    checkedIn: eventTickets.filter((ticket) => state.times.has(ticket.id)).length,
    eventId: event.id,
    eventName: event.name,
    organizerName,
    total: eventTickets.length,
  };
};

const completeCheckIn = (state: State, ticket: Ticket, actorId: string): CheckInResult => {
  const occurredAt = state.times.get(ticket.id);
  if (Predicate.isNotNullish(occurredAt)) {
    return { attendeeName: ticket.attendeeName, occurredAt, status: "already-checked-in" };
  }

  // Record the check-in and append its audit entry in the same synchronous transition.
  state.times.set(ticket.id, fixedNow);
  state.audit.push({ actorId, occurredAt: fixedNow, ticketId: ticket.id });
  return { attendeeName: ticket.attendeeName, occurredAt: fixedNow, status: "checked-in" };
};

const checkInTicket = (state: State, organizerId: string, ticketCode: string): CheckInResult => {
  const code = ticketCode.trim().toUpperCase();
  if (!ticketPattern.test(code)) {
    return { status: "invalid-ticket" };
  }

  const ticket = tickets.find((candidate) => candidate.code === code);
  if (Predicate.isNullish(ticket)) {
    return { status: "not-found" };
  }

  const authorized = events.some(
    (event) => event.id === ticket.eventId && event.organizerId === organizerId,
  );
  if (!authorized) {
    return { status: "forbidden" };
  }
  return completeCheckIn(state, ticket, organizerId);
};

// The demonstration keeps one store per Worker instance. Real deployments need a database transaction.
export const makeCheckInStore = (): CheckInStore => {
  const state: State = { audit: [], times: new Map() };
  return {
    checkIn: (organizerId, code) => checkInTicket(state, organizerId, code),
    preview: (organizerId, eventId = "event-summit") => {
      const event = events.find(
        (candidate) => candidate.id === eventId && candidate.organizerId === organizerId,
      );
      const organizer = organizers.find((candidate) => candidate.id === organizerId);
      if (Predicate.isNullish(event) || Predicate.isNullish(organizer)) {
        return missingPreview;
      }
      return previewEvent(state, event, organizer.name);
    },
  };
};
