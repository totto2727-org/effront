import { Function, Predicate } from "effect";
import type { JSX } from "react";
import type { CheckInResult, EventPreview } from "./data.ts";

type EventProps = Readonly<{
  event: EventPreview;
  pending: boolean;
  result: CheckInResult | null;
  submit: (formData: FormData) => void;
}>;

const message = (result: CheckInResult): string => {
  switch (result.status) {
    case "checked-in": {
      return `${result.attendeeName} checked in at ${result.occurredAt}.`;
    }
    case "already-checked-in": {
      return `${result.attendeeName} was already checked in at ${result.occurredAt}.`;
    }
    case "invalid-ticket": {
      return "Enter a ticket code in the format EVENT-NAME.";
    }
    case "not-found": {
      return "No ticket matches that code.";
    }
    case "forbidden": {
      return "This organizer cannot check in that ticket.";
    }
    default: {
      return Function.absurd(result);
    }
  }
};

const ticketField = (
  <label>
    Ticket code
    <input defaultValue="SUMMIT-ADA" name="ticketCode" pattern="[A-Za-z0-9-]+" required />
  </label>
);

export const CheckInEvent = ({ event, pending, result, submit }: EventProps): JSX.Element => (
  <section aria-labelledby="event-title">
    <p data-testid="scope">Authorized organizer: {event.organizerName}</p>
    <h1 id="event-title">{event.eventName} check-in</h1>
    <p data-testid="count">
      {event.checkedIn} of {event.total} attendees checked in
    </p>
    <form action={submit}>
      {ticketField}
      <button disabled={pending} type="submit">
        Check in attendee
      </button>
    </form>
    {Predicate.isNotNullish(result) && (
      <p aria-live="polite" data-testid="check-in-result">
        {message(result)}
      </p>
    )}
    <h2>Authorized attendee preview</h2>
    <ul>
      {event.attendees.map((attendee) => (
        <li key={attendee.ticketCode}>
          {attendee.attendeeName}: {attendee.status}
        </li>
      ))}
    </ul>
    <h2>Audit entries</h2>
    <output data-testid="audit-count">{event.audit.length}</output>
  </section>
);
