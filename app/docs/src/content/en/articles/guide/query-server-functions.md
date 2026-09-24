# Query Server Functions

Use a Query Server Function to read server data from a Client Component without treating the call as a mutation or refreshing the current route.
It runs an existing Server Function through an Effect-aware client API.
Use an ordinary Server Function or a form action when the operation changes state and the UI should navigate or refresh.

## Call a query {#call}

Export a read-only Server Function in a module that starts with `"use server"`.
Its input Schema remains the server-side trust boundary.

```typescript
// src/ticket.ts
"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";

export const lookupTicket = EFFRONT.ServerFn.make({
  input: Schema.Struct({ ticketCode: Schema.NonEmptyString }),
  handler: ({ ticketCode }) => Effect.succeed({ ticketCode, status: "checked-in" as const }),
});
```

In a Client Component, wrap the imported Server Function with `query`.
The returned function accepts the same positional arguments and returns an `Effect`.

```tsx
"use client";

import { Effect } from "effect";
import { query } from "@effront/core/query";
import { lookupTicket } from "./ticket";

const lookup = query(lookupTicket);

export function TicketStatus({ ticketCode }: { ticketCode: string }) {
  const onCheck = () => void Effect.runPromiseExit(lookup({ ticketCode }));
  return <button onClick={onCheck}>Check ticket</button>;
}
```

`query(lookupTicket)` has the Effect result type `Effect<Output, ServerFnError>`.
A successful query returns its value after the Flight response fully completes and request resources release, and it does not request the standard Server Function route refresh.
A late transport failure therefore still becomes `ServerFnTransportError` rather than a successful query result.
Do not use it for writes whose UI depends on the normal mutation refresh.

## Keep a reactive result {#atom}

`queryAtom` creates an `AtomResultFn` for the same Server Function.
Use it when an Effect Reactivity atom is a better fit for the component's loading, success, and failure states.

```tsx
"use client";

import { queryAtom } from "@effront/core/query";
import { lookupTicket } from "./ticket";

export const ticketStatus = queryAtom(lookupTicket);
// Read ticketStatus({ ticketCode }) with the Effect Reactivity API used by the component.
```

The atom accepts the Server Function's original arguments.
The framework-only cancellation marker is not part of the encoded input, so the server still receives only `{ ticketCode }`.

## Set up optional atom integration {#atom-setup}

`query` works without an atom registry.
Use `queryAtom` only when the application opts into Effect Reactivity with [`@effect/atom-react`](https://www.npmjs.com/package/@effect/atom-react), installed at a version compatible with the application's Effect 4 release:

```sh
npm install @effect/atom-react
```

Place its `RegistryProvider` in the application's persistent Root Layout, not inside a page that navigation replaces.
That gives atom results one application-owned registry across page transitions.

```tsx
import { RegistryProvider } from "@effect/atom-react";
import { Effect } from "effect";
import { EFFRONT } from "./effront";

export const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) => Effect.succeed(<RegistryProvider>{children}</RegistryProvider>),
});
```

Read `ticketStatus({ ticketCode })` below that provider with the `@effect/atom-react` API selected by the component.

## Handle typed failures {#errors}

Queries fail in the Effect error channel with `ServerFnError`, exported by `@effront/core/query`:

| Error                    | Meaning                                                      | Useful fields                                   |
| ------------------------ | ------------------------------------------------------------ | ----------------------------------------------- |
| `ServerFnInputError`     | The Server Function input could not be decoded or validated. | `detail.name`, `detail.message`                 |
| `ServerFnDefect`         | The handler failed unexpectedly.                             | `digest`, optional `detail`                     |
| `ServerFnTransportError` | The browser could not complete the query transport.          | `detail.name`, `detail.message`, `detail.stack` |

Handle known tags with Effect error operators, and show a safe, user-facing message rather than exposing a defect detail or stack.
Expected business outcomes, such as a ticket that is already checked in, are usually clearer as a successful tagged value returned by the handler.
That keeps them separate from invalid input, defects, and transport failures.

## Cancellation and request lifetime {#cancellation}

Interrupting the Effect that `query` returns aborts its browser request through an `AbortSignal`.
Write handlers and dependent I/O so they honor cancellation.

On the server, the query runs in the request scope.
Resources acquired for that request remain available only while the response is active, then release when the response completes, fails, or is cancelled.
Do not use a query as a way to keep an application-wide service alive.

## Design provenance {#provenance}

Effront's Query Server Function design is a selective Vite adaptation informed by upstream effective-rsc commits [bcd3d255](https://github.com/nikhilsnayak/effective-rsc/commit/bcd3d255), [2df9211a](https://github.com/nikhilsnayak/effective-rsc/commit/2df9211a), and [91fa61ea](https://github.com/nikhilsnayak/effective-rsc/commit/91fa61ea).
The public Effront contract is the API exported from `@effront/core/query`.
Do not depend on upstream endpoint paths, HTTP methods, or startup-scoped lifetime assumptions, because Effront's Vite hosts use their own request-scoped integration.
