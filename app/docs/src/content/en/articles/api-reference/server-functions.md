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

> [!WARNING]
> Do not return host bindings or secrets.

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

Schema decoding does not establish identity or permissions.
Record IDs, hidden fields, and `previousState` remain client-supplied values.

## Execution constraints {#execution}

A function created from `EFFRONT.withMiddleware(...)` retains that application's identity and middleware chain.
The function's middleware wraps execution and the refreshed response.
See [Authentication and authorization](/en/best-practices/authentication-and-authorization) for independent page and function access checks.

Direct invocation with `await` in RSC or other server code rejects with `TypeError`.
Extract work needed by other server code into a regular Effect and call it from both places.

## Request protocol {#request-protocol}

Server Function POST requests use the shared [HTTP body-size and `Content-Length` limits](./http.md#handler), also documented for the [Fetch handler](./workers.md#fetch).
For browser calls, Effront passes `arraySizeLimit: 10_000` to React's argument decoder.

| Condition                                                                                                                                | Status |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `Origin` is absent or cannot be parsed as a URL, `Host` is absent, or the origin URL's `host` differs from the lowercased `Host` header. | `403`  |
| The body cannot be read, exceeds the body-size limit during reading, or cannot be parsed as multipart data.                              | `400`  |
| React cannot decode browser-call arguments, the decoded value is not an argument array, or the requested function cannot be loaded.      | `400`  |
| A native form body is not multipart, its action cannot be decoded, or it contains no Server Function action.                             | `400`  |
| `Content-Length` fails the [HTTP entry-point check](./http.md#handler).                                                                  | `413`  |
| A native form's Server Function execution fails, or React form-state decoding fails after execution.                                     | `500`  |

The `Origin` check compares URL `host`, including any port, rather than the full origin or scheme.
The HTTP `Content-Length` check runs before the Server Function checks.
A body that passes the header check can still exceed the received-byte limit and produce `400`.

Application input Schema failures are distinct from React protocol decoding failures.
For browser calls, Effront includes input Schema and handler failures in the function result.
The Flight response has status `200` if the refreshed page renders successfully.
The failed result rejects the invocation before Effront applies the [refreshed page](/en/advanced/server-function-execution-and-refresh#result-and-refresh).
