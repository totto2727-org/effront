# Event check-in

A Node and Vite-native Effront example for an organizer-scoped event check-in screen.

## Run

From the repository root, prepare workspace packages, then run this example:

```sh
vp exec --filter "./packages/*" -- vp pack
cd examples/check-in
vp dev
```

Use `SUMMIT-ADA` to check in the seeded attendee.
A repeated submission reports that the attendee was already checked in and does not add another audit record.

## Security model demonstrated

- This sample uses a fixed, server-only `currentOrganizer = demoOrganizer` to model the authentication boundary. It is not real authentication or role-scoped middleware, and browser input never supplies an organizer identity.
- Queries return only the event owned by that fixed demo organizer.
- The Server Function decodes an object input and the domain validates the ticket-code format before a state change.
- The in-memory transition checks the current state and appends its audit entry in one synchronous operation, making retrying the same request idempotent for this single-process demonstration.

## Deliberate limitation

This is deterministic, seeded, process-lifetime state only.
Restarting the Node host resets tickets and audit records.
It does not claim durable persistence or multi-instance atomicity.
A production adopter needs verified request authentication and role-scoped middleware, plus a database transaction that conditionally updates the ticket and inserts the audit record together.
