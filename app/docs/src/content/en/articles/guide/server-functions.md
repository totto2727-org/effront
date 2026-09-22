Server Functions let forms and Client Components invoke Effect handlers on the server, where schemas validate their input.
The greeting form below displays the server's reply with React's `useActionState`.
For a form that does not need a return value, use the [direct action variant](#forms).

Continue in the running [Getting started sample](./getting-started.md), which serves [http://127.0.0.1:1340](http://127.0.0.1:1340).

## Share the application definition {#identity}

Create `src/effront.ts` and import this same `EFFRONT` in the application entry and Server Function modules:

```typescript
import { Application } from "@effront/core";

export const EFFRONT = Application.effront();
```

Do not create separate application definitions for the Page and its action.
For actions that need application services, declare and provide them as in the [services guide](/en/guide/effect).

## Return form state {#state}

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
Previous state remains client-controlled input even after validation.
Do not use it as proof of permissions or stored data.

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

## Render and submit the form {#application}

Create `src/entry.effront.tsx`:

```tsx
import { Effect } from "effect";
import { EFFRONT } from "./effront";
import { GreetingForm } from "./greeting-form";

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="en">
        <body>{children}</body>
      </html>,
    ),
});

const HomePage = EFFRONT.Page.make({
  render: () => Effect.succeed(<GreetingForm />),
});

export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage),
});
```

Open [http://127.0.0.1:1340](http://127.0.0.1:1340), enter `Ada`, and select **Greet**.
The form displays `Hello, Ada.` after submission.

## Submit without returning state {#forms}

For a form that needs no result value, return `void` and pass the Server Function directly to `action`.
Create `src/record-name.ts`:

```typescript
"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";

export const recordName = EFFRONT.ServerFn.make({
  input: Schema.fromFormData(Schema.Struct({ name: Schema.NonEmptyString })),
  handler: ({ name }) => Effect.logInfo("Name submitted", { name }),
});
```

Remove the `GreetingForm` import, import `recordName` into the entry module, and replace `HomePage`:

```tsx
import { recordName } from "./record-name";

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

Submission writes `Name submitted` to the server log.
It does not persist data or display a completion message.
Before replacing logging with a protected update, authenticate the caller and authorize the operation in the handler or its [Middleware](/en/guide/middleware).
A protected page does not protect the action, and hidden form fields are still client-controlled.

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
An array of Schemas describes positional arguments.
`Schema.Array(...)` or `Schema.Tuple(...)` describes a single array-valued argument.

Do not call Server Functions directly from a Page or other server-side code.
Extract a shared service or Effect function when server-side callers need the same operation.

## Handle updates and failures {#refresh}

After a successful call, Effront renders the current route again.
Read persisted values in the Page so that refresh shows the update.

Schema decoding failures prevent the handler from running.
Decoding and handler failures become action failures, not automatic updates to `state.message`.
For expected business failures, return a state value from the handler.
If invalid fields need inline feedback, choose a Schema that lets the handler receive and report those values rather than rejecting them first.
See React's [useActionState reference](https://react.dev/reference/react/useActionState) for state and error handling.
