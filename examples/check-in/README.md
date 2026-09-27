# Event check-in

An Alchemy-managed Effront Worker example of organizer-scoped queries, a native check-in action, and shared reactive preview state. Authentication and persistence are deliberately simulated.

## Usage

After preparing the workspace as described in [examples/AGENTS.md](../AGENTS.md), start the example from the repository root:

```sh
cd examples/check-in
vp run dev
```

Open the URL reported by Vite, then submit the seeded ticket code `SUMMIT-ADA`. Repeating the submission reports an existing check-in without adding another audit record. Alchemy CLI development requires the Cloudflare profile described in the [integration guide](../../packages/alchemy/docs/INTEGRATION.md); the independent browser suite under `tests/e2e-check-in/` runs against an auth-free local Worker instead.

## API

- [`src/features/check-in/server.ts`](src/features/check-in/server.ts) exposes the query and action; [`src/features/check-in/client.tsx`](src/features/check-in/client.tsx) consumes them through an atom registry shared by the page.
- The server fixes the current organizer to a demo identity. Browser input cannot choose the organizer, but this example does not implement authentication or role-scoped middleware.
- [`src/entry.workers.ts`](src/entry.workers.ts) provides a Worker-instance-local check-in store through the application host binding. Ticket state and audit entries reset when the instance restarts and are not shared across instances. A production implementation needs authenticated authorization and a durable database transaction that updates the ticket and inserts its audit entry together.

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
