`EFFRONT.ServerFn.make` lets a form submission or client interaction run an Effect-based operation on the server.
Define the values the caller may send, implement the operation against decoded values, and return the data the caller needs.
This reference covers that contract, including argument shapes and the checks required before performing a protected operation.
For the surrounding React components and application setup, use the [Server Functions guide](/en/guide/server-functions).

## Define a callable operation {#make}

Create an operation with `EFFRONT.ServerFn.make({ input, handler })`.
Use the application's shared `EFFRONT` definition so the function belongs to the same application as its pages and services.
The following definition fragments assume `Effect` and `Schema` are imported from `effect`.
To expose these functions to React, export them from a `"use server"` module.

```typescript
const rename = EFFRONT.ServerFn.make({
  input: Schema.Struct({ name: Schema.NonEmptyString }),
  handler: ({ name }) => Effect.succeed({ name }),
});
const describe = EFFRONT.ServerFn.make({
  input: [Schema.FiniteFromString, Schema.String],
  handler: (count, label) => Effect.succeed({ count, label }),
});
```

These minimal handlers return data without saving it.
For `rename`, sending `{ name: "Ada" }` produces `{ name: "Ada" }` as the result.
For `describe`, the caller sends `"2"` and `"items"`, but the handler works with the number `2` and the string `"items"`.
Its result is `{ count: 2, label: "items" }`.
The distinction matters whenever a Schema transforms input: callers use its `Encoded` type, while handlers use its decoded `Type`.

| Part of the definition      | Contract                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `input`                     | One Schema decoder or a readonly array of decoders, determining the accepted arguments.                            |
| `handler`                   | Receives the decoded arguments and returns `Effect.Effect<Output, E, AvailableServices>`, with any error type `E`. |
| Function returned by `make` | Accepts the `Encoded` arguments and returns `Promise<Output>` when called through React.                           |

The handler's successful Effect value determines `Output`.
It is not re-encoded through the input Schema.
Return only [values React can serialize](https://react.dev/reference/rsc/use-server#serializable-arguments-and-return-values), and leave host `env` bindings and secrets out of the result.

## Match the signature to the caller {#arguments}

Choose `input` based on the arguments the calling code will supply, not merely on the shape of the value you want inside the handler.
A Schema array describes several positional arguments, whereas an array or tuple Schema describes one argument containing a collection.

| Caller needs to pass          | `input`                                        | Handler receives                                          |
| ----------------------------- | ---------------------------------------------- | --------------------------------------------------------- |
| A single string               | `Schema.String`                                | One `string`.                                             |
| A string followed by a number | `[Schema.String, Schema.Finite]`               | Two arguments in that order.                              |
| A tuple as one value          | `Schema.Tuple([Schema.String, Schema.Finite])` | One `[string, number]` tuple.                             |
| An array as one value         | `Schema.Array(Schema.String)`                  | One array of strings.                                     |
| No values                     | `[]`                                           | No arguments, so the handler has the form `() => Effect`. |

For `useActionState`, React supplies the previous state first and the submitted `FormData` second.
Give each its own Schema so the handler can work with a validated state object and decoded form fields:

```typescript
const update = EFFRONT.ServerFn.make({
  input: [
    Schema.Struct({ count: Schema.Finite }),
    Schema.fromFormData(Schema.Struct({ name: Schema.NonEmptyString })),
  ],
  handler: (previousState, form) =>
    Effect.succeed({
      count: previousState.count + 1,
      name: form.name,
    }),
});
```

Here, the caller supplies `{ count: number }` and `FormData`, while the handler receives `{ count: number }` and `{ name: string }`.
The returned state contains the submitted name and a count increased by one.
Effront decodes all positional arguments before invoking the handler, so a decoding failure in either argument prevents the handler from running.
That validates the shape of the state and form fields, not the caller's authority to use them.

Input decoding failures and uncaught handler failures reject the client invocation instead of becoming the function's `Output` or the next action state.
To show expected domain failures as form state, return an explicit serializable result from the handler rather than failing its Effect.

## Protect and reuse the operation {#execution}

Check authentication and authorization in [Middleware](/en/guide/middleware) or in the handler before performing a protected operation.
A valid identifier, hidden form field, or previous state is still client-supplied input.
Passing Schema validation does not establish that the caller may read or change the corresponding resource.

When those checks rely on services supplied by Middleware, create the Server Function from the relevant `EFFRONT.withMiddleware(...)` definition.
The function retains that definition's application identity and Middleware chain, and its handler can require the services available in that scope.
Use this scoped definition rather than creating a separate application for the operation.

Keep the React entry point separate from code you also need to call on the server.
A Server Function cannot be directly called with `await` like an ordinary async function in RSC or other server code: that call is rejected with a `TypeError`.
Extract reusable work into a regular Effect, then call it from the Server Function's handler and from other server code as needed.
