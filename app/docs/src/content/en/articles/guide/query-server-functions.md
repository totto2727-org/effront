Use a Query Server Function to read one server value from a Client Component without refreshing the current route.
When the operation changes state and the UI should navigate or refresh, use an ordinary Server Function or a form action.

## Call a query {#call}

Export a read-only Server Function in a module that starts with `"use server"`.
Then wrap its client import with `query`.
The input Schema remains the server-side trust boundary.

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

```tsx
// src/ticket-status.tsx
"use client";

import { Effect } from "effect";
import { query } from "@effront/core/query";
import { useState } from "react";
import { lookupTicket } from "./ticket";

const lookup = query(lookupTicket);

export function TicketStatus({ ticketCode }: { ticketCode: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const onCheck = () => {
    void Effect.runPromise(lookup({ ticketCode }))
      .then(({ status }) => setStatus(status))
      .catch(() => setStatus("Could not check ticket."));
  };
  return (
    <>
      <button onClick={onCheck}>Check ticket</button>
      <p aria-live="polite">{status}</p>
    </>
  );
}
```

`query(lookupTicket)` accepts the Server Function's original arguments and returns an `Effect` without requesting the standard Server Function route refresh.
For expected outcomes and operational failures, use [Error handling for Server Functions](../best-practices/server-function-error-handling.md).

## Keep a reactive result {#atom}

When an Effect Reactivity atom is a better fit for the component's loading, success, and failure states, use `queryAtom`.

```tsx
"use client";

import { queryAtom } from "@effront/core/query";
import { useAtom } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { useEffect } from "react";
import { lookupTicket } from "./ticket";

const ticketStatus = queryAtom(lookupTicket);

export function TicketStatusAtom({ ticketCode }: { ticketCode: string }) {
  const [result, run] = useAtom(ticketStatus);
  useEffect(() => {
    run([{ ticketCode }]);
  }, [ticketCode, run]);

  if (AsyncResult.isInitial(result)) return <p>Loading…</p>;
  if (AsyncResult.isFailure(result)) return <p role="alert">Could not check ticket.</p>;
  return <p>{result.value.status}</p>;
}
```

## Set up optional atom integration {#atom-setup}

`query` does not use an atom registry.
Use `queryAtom` only when the application uses Effect Reactivity.
For installation and React integration with your Effect 4 release, use the [official `@effect/atom-react` README](https://github.com/Effect-TS/effect/blob/main/packages/atom/react/README.md#installation).

To share atom state across pages, put `RegistryProvider` in a client boundary that persists across navigation.
The single-page [check-in example](https://github.com/totto2727-org/effront/blob/main/examples/check-in/src/features/check-in/client.tsx) instead puts it inside that page's Client Component.
Render `TicketStatusAtom` below that provider.
