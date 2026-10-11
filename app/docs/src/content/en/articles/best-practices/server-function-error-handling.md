Server Functions have two kinds of error handling.
Expected business outcomes are data.
Invalid input and operational failures reach the client boundary.
This distinction is applicable to mutation, query, and stream calls.

## Return expected outcomes as data {#expected}

For an expected outcome such as a reserved name, return a tagged success value from the handler.
Mutation callers can render that value with `useActionState`.
Query and stream callers can render it like any other result.

```typescript
// src/greet.ts
"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";

export const greet = EFFRONT.ServerFn.make({
  input: Schema.Struct({ name: Schema.NonEmptyString }),
  handler: ({ name }) =>
    Effect.succeed(
      name === "Admin"
        ? { _tag: "ReservedName" as const }
        : { _tag: "Greeting" as const, message: `Hello, ${name}.` },
    ),
});
```

This keeps expected outcomes separate from input validation and unexpected failures.

## Show safe failure messages {#operational}

`query` and `stream` report client-side operational failures through the Effect error channel as `ServerFnError` from `@effront/core/query`.

| Error                    | Meaning                                      | Show users                                 |
| ------------------------ | -------------------------------------------- | ------------------------------------------ |
| `ServerFnInputError`     | The input could not be decoded or validated. | A message explaining the input is invalid. |
| `ServerFnDefect`         | The handler failed unexpectedly.             | A generic retry message.                   |
| `ServerFnTransportError` | The browser could not complete the request.  | A connection and retry message.            |

Handle known tags.
Do not expose a defect's `detail` or stack.
The example that follows uses [`lookupTicket` from the Query guide](../guide/query-server-functions.md#call).

```tsx
// src/ticket-message.ts
"use client";

import { query } from "@effront/core/query";
import { Effect } from "effect";
import { lookupTicket } from "./ticket";

const lookupMessage = (ticketCode: string) =>
  query(lookupTicket)({ ticketCode }).pipe(
    Effect.map(({ status }) => status),
    Effect.catchTags({
      ServerFnInputError: () => Effect.succeed("Invalid ticket code."),
      ServerFnDefect: () => Effect.succeed("Could not check ticket."),
      ServerFnTransportError: () => Effect.succeed("Connection lost. Please retry."),
    }),
  );
```

For mutations, schema decoding and unexpected handler failures are action failures, not updates to `useActionState` state.
Use React's [useActionState reference](https://react.dev/reference/react/useActionState) to select the surrounding error UI.
