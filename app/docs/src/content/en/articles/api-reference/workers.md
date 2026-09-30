`@effront/core/workers` provides a Web Fetch handler and typed access to host-supplied request values.

## createFetchHandler {#fetch}

`createFetchHandler(application)` accepts an application whose Layer requirements are satisfied by `HttpRouter.HttpRouter` and `HttpServerRequest.HttpServerRequest`.
It returns a `FetchHandler`:

```typescript
import { createFetchHandler } from "@effront/core/workers";
import application from "./entry.effront";

export default { fetch: createFetchHandler(application) };
```

The exported handler type is:

```typescript
export type FetchHandler<Env = unknown, ExecutionContext = unknown> = (
  request: Request,
  env: Env,
  executionContext: ExecutionContext,
) => Promise<Response>;
```

`createFetchHandler` returns the default type with `unknown` host values.
Reader type arguments describe those values inside application Effects.
For arbitrary external service requirements, use [native HTTP capture](./http.md#capture) or [Alchemy](./alchemy.md).

The application Layer is acquired for each invocation.
Its Scope stays open until the response body completes, fails, or is cancelled.
A bodyless response releases it immediately.
Buffered responses can release request services after response construction; a streaming body must retain them through consumption.

Invalid `Content-Length` values and values above 10 MiB produce `413`.
Server Function POST requests also enforce a 10 MiB limit on received bytes without that header.
Custom HTTP route bodies without `Content-Length` are not universally measured.

## Core context readers {#readers}

Import these functions from `@effront/core/workers`.

| API                                                                          | Result                                                               |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `getWorkersEnv<Env = unknown>()`                                             | Effect yielding `Env`                                                |
| `getWorkersRequestContext<Env = unknown, ExecutionContext = unknown>()`      | Effect yielding `WorkersRequestContext<Env, ExecutionContext>`       |
| `createWorkersContextAccessors<Env = unknown, ExecutionContext = unknown>()` | Object containing the two reader functions with fixed type arguments |

```typescript
import { createWorkersContextAccessors } from "@effront/core/workers";

type Env = { readonly APP_LABEL: string };
type HostContext = { waitUntil(promise: Promise<unknown>): void };
export const { getWorkersEnv, getWorkersRequestContext } = createWorkersContextAccessors<
  Env,
  HostContext
>();
```

The factory creates readers, not a service or Layer.
Its readers share the same request Context as the direct accessors and preserve the identity of the host-provided objects.
Each reader returns an Effect that reads the current request when executed, including when the Effect was created earlier.
It has no typed failure or service requirement.
A missing request Context causes a `TypeError` defect.
Type arguments do not validate host values at runtime.

> [!WARNING]
> Host values are not automatically serialized into HTML or Flight.
> Values rendered by a Page or returned by a ServerFn can reach the browser.
> Keep secrets out of those outputs.

## Cloudflare context readers {#cloudflare}

`@effront/cloudflare/workers` reads the same Context and fixes the execution-context type to `CloudflareExecutionContext`.

| API or type                                      | Contract                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------ |
| `getWorkersEnv<Env = unknown>()`                 | Effect yielding `Env`                                                    |
| `getWorkersRequestContext<Env = unknown>()`      | Effect yielding `WorkersRequestContext<Env, CloudflareExecutionContext>` |
| `createWorkersContextAccessors<Env = unknown>()` | The two readers with a shared `Env` type                                 |
| `CloudflareExecutionContext`                     | `{ waitUntil(promise: Promise<unknown>): void }`                         |

These readers have the same execution, missing-context, and runtime-validation rules as the core readers.

## WorkersRequestContext {#context}

`WorkersRequestContext` from `@effront/core/workers` exports both a type and an Effect `Context.Reference` value.
The reference holds `WorkersRequestContext<unknown, unknown>` and throws `TypeError` by default when no value is provided.

| Readonly field     | Type               | Value                                   |
| ------------------ | ------------------ | --------------------------------------- |
| `env`              | `Env`              | Host environment variables and bindings |
| `executionContext` | `ExecutionContext` | Host execution context                  |
| `request`          | `Request`          | Original Web Request                    |

`createFetchHandler` supplies these exact host values separately for each request.
