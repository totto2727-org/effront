`EFFRONT.ServerFn.make` creates a React Server Function with Schema-decoded arguments and an Effect handler.

## ServerFn.make {#make}

`EFFRONT.ServerFn.make({ input, handler })` returns a function with the caller signature `(...encodedArgs) => Promise<Output>`.
Export it from a `"use server"` module:

```typescript
"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";

export const describe = EFFRONT.ServerFn.make({
  input: [Schema.FiniteFromString, Schema.String],
  handler: (count, label) => Effect.succeed({ count, label }),
});
```

`./effront` exports the application's shared factory.
A client call with `"2"` and `"items"` resolves to `{ count: 2, label: "items" }`.

| Option    | Contract                                                                                       |
| --------- | ---------------------------------------------------------------------------------------------- |
| `input`   | One Schema decoder or a readonly array of decoders. Callers pass each Schema's `Encoded` type. |
| `handler` | Receives decoded `Type` arguments and returns `Effect.Effect<Output, E, AvailableServices>`.   |

`AvailableServices` includes application services and services from the factory's middleware scope.
The successful handler value determines `Output`.
It is not re-encoded with the input Schema.
Inputs and outputs must satisfy [React's serialization contract](https://react.dev/reference/rsc/use-server#serializable-arguments-and-return-values).
Do not return host bindings or secrets.
For React components that call the function, see [Server Functions](/en/guide/server-functions).

## Argument shapes {#arguments}

| `input`                                        | Caller arguments | Handler arguments            |
| ---------------------------------------------- | ---------------- | ---------------------------- |
| `Schema.String`                                | One string       | One string                   |
| `[Schema.FiniteFromString, Schema.String]`     | String, string   | Number, string               |
| `Schema.Tuple([Schema.String, Schema.Finite])` | One tuple        | One `[string, number]` tuple |
| `Schema.Array(Schema.String)`                  | One string array | One string array             |
| `[]`                                           | None             | None                         |

An array of Schemas describes positional arguments.
An array or tuple Schema describes one argument.
A single decoder ignores extra native arguments and decodes `undefined` when its argument is omitted.

`useActionState` supplies previous state followed by `FormData`:

```typescript
"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";

export const update = EFFRONT.ServerFn.make({
  input: [
    Schema.Struct({ count: Schema.Finite }),
    Schema.fromFormData(Schema.Struct({ name: Schema.NonEmptyString })),
  ],
  handler: (previousState, form) =>
    Effect.succeed({ count: previousState.count + 1, name: form.name }),
});
```

All positional arguments are decoded before the handler runs.
Input decoding failures and uncaught handler failures reject the invocation, rather than becoming `Output` or the next action state.
Return a serializable result for expected domain failures that should appear as form state.

## Execution constraints {#execution}

Authentication and authorization must run in the handler or its [middleware](/en/guide/middleware) before a protected operation.
Validated identifiers, hidden fields, and previous state remain client-supplied data, not proof of authority.
Create the function from the relevant `EFFRONT.withMiddleware(...)` factory when those checks require scoped services.
The function retains that application's identity and middleware chain.

Direct invocation with `await` in RSC or other server code rejects with `TypeError`.
Extract work needed by other server code into a regular Effect and call it from both places.
