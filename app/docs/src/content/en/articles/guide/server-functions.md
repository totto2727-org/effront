Server Functions let forms and Client Components invoke Effect handlers on the server, where schemas validate their input.
Start with a form that sends a name directly to a Server Function, then add a reply and pending state with `useActionState`.

Continue after changing the heading to `Hello, Effront` in [Getting started](./getting-started.md), with the sample running at the URL displayed by the development server.

## Share the application definition {#identity}

Create `src/effront.ts` and import this same `EFFRONT` in the application entry and Server Function modules:

```typescript
import { Application } from "@effront/core";

export const EFFRONT = Application.effront();
```

> [!WARNING]
> Do not create separate application definitions for the Page and its action.

For actions that need application services, declare and provide them as in the [services guide](/en/guide/effect).

## Submit a form directly {#forms}

Pass the Server Function directly to the form's `action`.
Its handler returns an `Effect<void>`.
Create `src/record-name.ts` with `"use server"` first:

```typescript
"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";

export const recordName = EFFRONT.ServerFn.make({
  input: Schema.fromFormData(Schema.Struct({ name: Schema.NonEmptyString })),
  handler: ({ name }) => Effect.logInfo("Name submitted", { name }),
});
```

## Render and submit the form {#application}

Update `src/entry.effront.tsx` to import the shared definition and render the form:

```tsx
// src/entry.effront.tsx: replace the Application import.
import { EFFRONT } from "./effront";
// Add to the imports.
import { recordName } from "./record-name";

// Remove the local EFFRONT declaration.
// Replace HomePage.
const HomePage = EFFRONT.Page.make({
  render: () =>
    Effect.succeed(
      <form action={recordName}>
        <label>
          Name
          <input name="name" required />
        </label>
        <button type="submit">Record name</button>
      </form>,
    ),
});
```

Open the URL displayed by the development server, enter `Ada`, and select **Record name**.
Submission writes `Name submitted` to the server log.
It does not persist data or display a completion message.

> [!WARNING]
> Server Functions require input validation and access control independently of the page.
> They are exposed as APIs that can be called independently of page navigation.

## Add form state with useActionState {#state}

To display the server's reply and disable the button while submitting, add a state-returning Server Function and a Client Component.

Create `src/greet.ts` with `"use server"` first:

```typescript
"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";

export const greet = EFFRONT.ServerFn.make({
  input: [
    Schema.Struct({ message: Schema.String }),
    Schema.fromFormData(Schema.Struct({ name: Schema.NonEmptyString })),
  ],
  handler: (_previousState, { name }) => Effect.succeed({ message: `Hello, ${name}.` }),
});
```

`useActionState` sends the previous state, then `FormData`.
The `input` array validates those arguments in the same order before the handler runs.

> [!WARNING]
> `previousState` is also an untrusted source of information sent by the client.
> Prefer separately validated form arguments where possible.
> If you use `previousState`, validate it like other inputs, as its Schema does in the example above.

Create `src/greeting-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { greet } from "./greet";

export function GreetingForm() {
  const [state, formAction, pending] = useActionState(greet, { message: "" });
  return (
    <form action={formAction}>
      <label>
        Name
        <input name="name" required />
      </label>
      <button disabled={pending} type="submit">
        Greet
      </button>
      <p aria-live="polite">{state.message}</p>
    </form>
  );
}
```

Pass `greet` directly to `useActionState`, without an async wrapper, to preserve form submission before JavaScript loads.
`required` checks the field in the browser.
The Schema still validates it on the server.

In `src/entry.effront.tsx`, replace the direct form with `GreetingForm`:

```tsx
// src/entry.effront.tsx: replace the recordName import.
import { GreetingForm } from "./greeting-form";

// Replace HomePage.
const HomePage = EFFRONT.Page.make({
  render: () => Effect.succeed(<GreetingForm />),
});
```

Open the URL displayed by the development server, enter `Ada`, and select **Greet**.
The form displays `Hello, Ada.` after submission.

## Accept an object argument {#input}

For a Client Component event handler that already has an object, use `Schema.Struct` directly.
Create `src/greet-object.ts`:

```typescript
"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";

export const greetObject = EFFRONT.ServerFn.make({
  input: Schema.Struct({ name: Schema.NonEmptyString }),
  handler: ({ name }) => Effect.succeed(`Hello, ${name}.`),
});
```

A client caller can import it and call `await greetObject({ name: "Ada" })`.
Callers pass encoded input and handlers receive decoded values.

> [!WARNING]
> Do not call Server Functions directly from a Page or other server-side code.
> Extract a shared service or Effect function when server-side callers need the same operation.

## Handle updates {#refresh}

After a successful call, Effront renders the current route again.
Read persisted values in the Page so that refresh shows the update.

## Handle failures {#errors}

Return expected business failures as state so `useActionState` can display them.
In `src/greet.ts`, treat `Admin` as a reserved name:

```typescript
// src/greet.ts: replace greet to return an expected failure as form state.
export const greet = EFFRONT.ServerFn.make({
  input: [
    Schema.Struct({ message: Schema.String }),
    Schema.fromFormData(Schema.Struct({ name: Schema.NonEmptyString })),
  ],
  handler: (_previousState, { name }) => {
    if (name === "Admin") {
      return Effect.succeed({ message: "That name is reserved." });
    }
    return Effect.succeed({ message: `Hello, ${name}.` });
  },
});
```

Enter `Admin` and select **Greet** to display `That name is reserved.`.
Enter `Ada` and submit again to display `Hello, Ada.`.
The reserved-name branch returns state, so it updates `state.message` instead of failing the action.

Schema decoding failures prevent the handler from running.
For example, the existing `Schema.NonEmptyString` rejects an empty name before it reaches either branch.
Decoding and handler failures become action failures, not automatic updates to `state.message`.
If invalid fields need inline feedback, choose a Schema that lets the handler receive and report those values rather than rejecting them first.
See React's [useActionState reference](https://react.dev/reference/react/useActionState) for state and error handling.
