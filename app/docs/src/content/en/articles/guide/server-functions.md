A form submission often needs more than a browser-side event handler: it needs to validate input, call a server-side service, and show the result.
An Effront Server Function connects those steps without a separate API endpoint.
This guide builds a name form whose submission returns a greeting, then shows how to adapt that pattern for a side effect or an object argument.

The main example uses `useActionState` because the user needs feedback from the server.
If your form does not need a return value, the [direct form action](#forms) variant is simpler.

## Make the service available to the action {#identity}

The form will send a name, and a service will turn it into a greeting.
Create `src/greeting.ts` with the following implementation, or reuse `Greeting` from the [services guide](/en/guide/effect).
The sample greeting is Japanese: `こんにちは、Ada さん。` means "Hello, Ada."

```typescript
import { Context, Effect, Layer } from "effect";

export class Greeting extends Context.Service<
  Greeting,
  { readonly message: (name: string) => Effect.Effect<string> }
>()("app/services/Greeting") {
  static readonly layer = Layer.succeed(Greeting, {
    message: (name) => Effect.succeed(`こんにちは、${name} さん。`),
  });
}
```

Declare that service in `src/effront.ts`.
Import this same `EFFRONT` in both the application entry and the Server Function rather than calling `Application.effront()` separately for each file.
You will supply the service implementation when assembling the page.

```typescript
import { Application } from "@effront/core";
import { Greeting } from "./greeting";

export const EFFRONT = Application.effront<Greeting>();
```

## Return a greeting to the form {#state}

Create `src/greet.ts` with `"use server"` at the top.
`ServerFn.make` receives the input Schemas and a handler that returns an Effect.
Here, the handler calls `Greeting.message` and returns the next form state as `{ message }`.

`useActionState` passes the previous state followed by the submitted `FormData`.
The `input` array describes those two arguments in that order.
`Schema.fromFormData` decodes the `name` field, and `Schema.NonEmptyString` rejects an empty name before the handler runs.
The previous state is validated too, but validation does not make client-supplied state a trusted record of permissions or stored data.

```typescript
"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";
import { Greeting } from "./greeting";

const StateSchema = Schema.Struct({ message: Schema.String });
const FormSchema = Schema.fromFormData(Schema.Struct({ name: Schema.NonEmptyString }));

export const greet = EFFRONT.ServerFn.make({
  input: [StateSchema, FormSchema],
  handler: (_previousState, { name }) =>
    Effect.gen(function* () {
      const greeting = yield* Greeting;
      const message = yield* greeting.message(name);
      return { message };
    }),
});
```

Now create `src/greeting-form.tsx` as a Client Component.
Pass the Server Function itself to `useActionState`, connect its returned action to the form, and render `state.message` as feedback.
The `pending` value disables the button during submission.

Keep the direct `greet` reference rather than adding an async wrapper around it.
This preserves the native Server Function reference React uses to support form submissions before JavaScript has loaded.

```tsx
"use client";

import { useActionState } from "react";
import { greet } from "./greet";

export function GreetingForm() {
  const [state, formAction, pending] = useActionState(greet, { message: "" });
  return (
    <form action={formAction}>
      <input name="name" required />
      <button disabled={pending} type="submit">
        挨拶する
      </button>
      <p aria-live="polite">{state.message}</p>
    </form>
  );
}
```

## Run the complete round trip {#application}

Add the form to `src/entry.effront.tsx` and provide `Greeting.layer` to `EFFRONT.make`.
The shared `EFFRONT` declares which service the handler needs, while this Layer supplies its implementation.

```tsx
import { Effect } from "effect";
import { EFFRONT } from "./effront";
import { Greeting } from "./greeting";
import { GreetingForm } from "./greeting-form";

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="ja">
        <body>{children}</body>
      </html>,
    ),
});

const HomePage = EFFRONT.Page.make({
  render: () =>
    Effect.succeed(
      <main>
        <GreetingForm />
      </main>,
    ),
});

export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage),
  layer: Greeting.layer,
});
```

Open `/` in your running development application.
Enter `Ada` and press `挨拶する` ("Greet").
When the submission finishes, the form displays `こんにちは、Ada さん。`.
The displayed text came from the server-side service, not from the input field's client-side event handler.

The form's `required` attribute gives the browser an immediate empty-field check.
The Schema still validates the submitted data on the server, where clients cannot bypass it by changing the page.
Failure feedback needs an explicit design, covered under [updates and failures](#refresh).

## Use a direct action for side effects {#forms}

When a form only needs to perform an operation, a Server Function returning `void` can go directly in `<form action>`.
Create `src/follow-author.ts` for this variant.
It decodes an author ID and logs it, without returning state for the form to display.

```typescript
"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";

export const followAuthor = EFFRONT.ServerFn.make({
  input: Schema.fromFormData(Schema.Struct({ authorId: Schema.NonEmptyString })),
  handler: ({ authorId }) => Effect.logInfo("著者をフォロー", { authorId }),
});
```

Create `src/follow-author-button.tsx` to submit the ID.
The hidden field's `name="authorId"` matches the Schema field.

```tsx
import { Effect } from "effect";
import { EFFRONT } from "./effront";
import { followAuthor } from "./follow-author";

export const FollowAuthorButton = EFFRONT.Component.make({
  render: ({ authorId }: { readonly authorId: string }) =>
    Effect.succeed(
      <form action={followAuthor}>
        <input name="authorId" type="hidden" value={authorId} />
        <button type="submit">フォローする</button>
      </form>,
    ),
});
```

This is a logging example, not a persistent follow feature.
Before replacing the log with a storage service call, authenticate the user and authorize the operation in [Middleware](/en/guide/middleware) or the handler.
A hidden field is still client-controlled input: a valid author ID does not prove that the current user may act on it.

To try both forms together, replace `src/entry.effront.tsx` with this version.

```tsx
import { Effect } from "effect";
import { EFFRONT } from "./effront";
import { Greeting } from "./greeting";
import { GreetingForm } from "./greeting-form";
import { FollowAuthorButton } from "./follow-author-button";

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="ja">
        <body>{children}</body>
      </html>,
    ),
});

const HomePage = EFFRONT.Page.make({
  render: () =>
    Effect.succeed(
      <main>
        <GreetingForm />
        <FollowAuthorButton authorId="ada" />
      </main>,
    ),
});

export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage),
  layer: Greeting.layer,
});
```

Press `フォローする` ("Follow") and inspect the server log for `著者をフォロー` ("Follow author") with `authorId` set to `ada`.
This form does not display a completion message because its action returns no form state.

## Accept an object instead of FormData {#input}

For a Client Component event handler that already has an object, describe that object directly with `Schema.Struct`.
The following `src/greet-object.ts` accepts `greetObject({ name: "Ada" })` from the client and returns the greeting string.

```typescript
"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";
import { Greeting } from "./greeting";

export const greetObject = EFFRONT.ServerFn.make({
  input: Schema.Struct({ name: Schema.NonEmptyString }),
  handler: ({ name }) => Effect.flatMap(Greeting, (service) => service.message(name)),
});
```

The caller supplies the Schema's encoded type, and the handler receives its decoded type.
Let the Schema infer the handler argument types rather than duplicating them in annotations.
An array of Schemas, as used with `useActionState`, describes separate positional arguments.
A single `Schema.Array(...)` or `Schema.Tuple(...)` describes one argument whose value is an array.

A Server Function is an entry point for React calls, not an ordinary async function to call from a Page or other server-side code.
Share the underlying service or Effect function when server-side callers need the same operation.
In these examples, that shared operation is `Greeting.message`.

## Decide how updates and failures appear {#refresh}

After a successful Server Function call, Effront renders the current route again.
If your handler saves data, read the persisted values in the Page so the refreshed route shows the update.
You do not need a separate request mechanism just to fetch the route again.

A failed action is different from a successful action that returns an error message as state.
Schema decoding failures occur before the handler runs, and both decoding failures and handler failures become action failures rather than automatically updating `state.message`.
For an expected business failure that belongs beside the form, convert it to a state value inside the handler.
Choose which invalid inputs the Schema should reject outright and which the handler should accept so it can return field feedback.
See React's [useActionState reference](https://react.dev/reference/react/useActionState) for state management and error handling.
