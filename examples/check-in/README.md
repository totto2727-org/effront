# Event check-in

A Node-hosted Effront example of organizer-scoped queries, a native check-in action, and shared reactive preview state. Authentication and persistence are deliberately simulated.

## Usage

After preparing the workspace as described in [examples/AGENTS.md](../AGENTS.md), start the example from its directory:

```sh
cd examples/check-in
vp dev
```

Open the URL reported by Vite, then submit the seeded ticket code `SUMMIT-ADA`. Repeating the submission reports an existing check-in without adding another audit record.

## API

- [`src/features/check-in/server.ts`](src/features/check-in/server.ts) exposes the query and action; [`src/features/check-in/client.tsx`](src/features/check-in/client.tsx) consumes them through an atom registry shared by the page.
- The server fixes the current organizer to a demo identity. Browser input cannot choose the organizer, but this example does not implement authentication or role-scoped middleware.
- Ticket state and audit entries live only in one Node process. A production implementation needs authenticated authorization and a durable database transaction that updates the ticket and inserts its audit entry together.

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
