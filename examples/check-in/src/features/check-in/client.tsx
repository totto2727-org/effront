"use client";

import { queryAtom } from "@effront/core/query";
import { useAtom } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import { useActionState, useEffect } from "react";
import { checkInAttendee, previewCheckIn } from "./server";

const previewAtom = queryAtom(previewCheckIn);

type ActionState = Awaited<ReturnType<typeof checkInAttendee>> | null;

export function CheckInConsole() {
  const [preview, queryPreview] = useAtom(previewAtom);
  const [result, submit, pending] = useActionState<ActionState, FormData>(
    async (_previous, formData) => {
      const ticketCode = formData.get("ticketCode");
      const next = await checkInAttendee({
        ticketCode: typeof ticketCode === "string" ? ticketCode : "",
      });
      queryPreview([]);
      return next;
    },
    null,
  );

  useEffect(() => {
    queryPreview([]);
  }, [queryPreview]);

  if (AsyncResult.isInitial(preview))
    return <p data-testid="preview-state">Loading authorized event preview…</p>;
  if (AsyncResult.isFailure(preview)) return <p role="alert">The preview query failed.</p>;
  if (preview.value === null)
    return <p role="alert">This organizer is not authorized to view this event.</p>;

  const event = preview.value;
  return (
    <section aria-labelledby="event-title">
      <p data-testid="scope">Authorized organizer: {event.organizerName}</p>
      <h1 id="event-title">{event.eventName} check-in</h1>
      <p data-testid="count">
        {event.checkedIn} of {event.total} attendees checked in
      </p>
      <form action={submit}>
        <label>
          Ticket code
          <input name="ticketCode" defaultValue="SUMMIT-ADA" pattern="[A-Za-z0-9-]+" required />
        </label>
        <button disabled={pending} type="submit">
          Check in attendee
        </button>
      </form>
      {result && (
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
}

function message(result: Exclude<ActionState, null>): string {
  switch (result.status) {
    case "checked-in":
      return `${result.attendeeName} checked in at ${result.occurredAt}.`;
    case "already-checked-in":
      return `${result.attendeeName} was already checked in at ${result.occurredAt}.`;
    case "invalid-ticket":
      return "Enter a ticket code in the format EVENT-NAME.";
    case "not-found":
      return "No ticket matches that code.";
    case "forbidden":
      return "This organizer cannot check in that ticket.";
  }
}
