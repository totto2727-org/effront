Connect an Effront application to a Fetch host, then access that request's bindings from application Effects.
The APIs on this page cover both sides of that connection: the handler receives host values, and readers make those values available to your Pages, Middleware, and application services.

- To implement a host entry point, use [`createFetchHandler`](#fetch).
- To read bindings or the original request, choose a [core reader](#readers).
- On Cloudflare, use the [Cloudflare readers](#cloudflare) to supply only your `Env` type.

## Connect an application with createFetchHandler {#fetch}

Import `createFetchHandler` from `@effront/core/workers` and pass it the application returned by `EFFRONT.make`.
The result can be assigned to the host's `fetch` entry point:

```typescript
import { createFetchHandler } from "@effront/core/workers";
import application from "./entry.effront";

export default { fetch: createFetchHandler(application) };
```

The application's Layer requirements must be satisfiable by `HttpRouter.HttpRouter` and `HttpServerRequest.HttpServerRequest`.
If it requires other external host services, use [native HTTP and `makeHttpEffect`](./http.md#capture) or the [Alchemy integration](./alchemy.md) instead.

For each invocation, the host passes a Web `Request`, environment bindings, and an execution context.
The handler runs the application for that request and returns a `Promise<Response>`.
Its public function type is:

```typescript
export type FetchHandler<Env = unknown, ExecutionContext = unknown> = (
  request: Request,
  env: Env,
  executionContext: ExecutionContext,
) => Promise<Response>;
```

`createFetchHandler` returns the default `FetchHandler`, with `unknown` for both host-specific types.
Specify those types through the readers when consuming host values in your application.

**Response lifetime.**
The application Layer is built separately for each request.
Its Scope remains open until the response body finishes, errors, or is cancelled.
A response without a body releases it immediately.
Returning a streaming `Response` therefore does not end the lifetime of the resources used to produce its body.

**Request-body limits.**
The entry point checks `Content-Length` and returns `413` for invalid values or values above 10 MiB.
Server Function POST requests also enforce a 10 MiB limit on the bytes actually received, even without that header.
Do not treat the header check as a universal body-size limit: this entry point does not measure every custom HTTP route body that lacks `Content-Length`.

## Choose a core reader for the values you need {#readers}

Import readers from `@effront/core/workers`.
Use `getWorkersEnv` for environment variables and bindings, or `getWorkersRequestContext` when you also need the original Request or host execution context.

| API                                                                          | Result                                                                                                                      |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `getWorkersEnv<Env = unknown>()`                                             | An Effect that returns the current `Env`.                                                                                   |
| `getWorkersRequestContext<Env = unknown, ExecutionContext = unknown>()`      | An Effect that returns `WorkersRequestContext<Env, ExecutionContext>`, containing `env`, `executionContext`, and `request`. |
| `createWorkersContextAccessors<Env = unknown, ExecutionContext = unknown>()` | A pair of `getWorkersEnv` and `getWorkersRequestContext` functions with the supplied types.                                 |

If several modules use the same binding types, define and export the pair once:

```typescript
import { createWorkersContextAccessors } from "@effront/core/workers";

type Env = { readonly APP_LABEL: string };
type HostContext = { waitUntil(promise: Promise<unknown>): void };
export const { getWorkersEnv, getWorkersRequestContext } = createWorkersContextAccessors<
  Env,
  HostContext
>();
```

The factory creates reader functions, not a new service or Layer.
Calling a reader creates an Effect.
Executing that Effect reads the current request's values.
For example, use `yield* getWorkersEnv()` in a Page, Middleware, or application Layer construction during Fetch request handling.
Reading without a provided request Context throws a `TypeError`.

The type arguments describe what the host supplies and do not perform runtime validation.
Match them to your host's bindings and execution context.
Host values are not automatically serialized into HTML or Flight, but values you render or return from a ServerFn reach the browser.
Keep secrets out of those outputs, even when the reader's type makes them accessible to server code.

## Use Cloudflare readers with an Env type {#cloudflare}

On Cloudflare, import the equivalent readers from `@effront/cloudflare/workers`.
They use the same request Context as the core readers, but fix the execution-context type to `CloudflareExecutionContext`, so only `Env` needs a type argument.

```typescript
import { Effect } from "effect";
import { createWorkersContextAccessors } from "@effront/cloudflare/workers";

type Env = { readonly APP_LABEL: string };
const { getWorkersEnv, getWorkersRequestContext } = createWorkersContextAccessors<Env>();

export const readLabel = Effect.gen(function* () {
  const env = yield* getWorkersEnv();
  const { executionContext } = yield* getWorkersRequestContext();
  executionContext.waitUntil(Promise.resolve());
  return env.APP_LABEL;
});
```

During a Fetch request, `readLabel` reads `APP_LABEL` and demonstrates how to call `waitUntil` on the supplied execution context.
Run it within the request Context, just like an Effect using a core reader.

| API / type                                       | Result or contract                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `getWorkersEnv<Env = unknown>()`                 | An Effect that returns `Env`.                                                    |
| `getWorkersRequestContext<Env = unknown>()`      | An Effect that returns `WorkersRequestContext<Env, CloudflareExecutionContext>`. |
| `createWorkersContextAccessors<Env = unknown>()` | The two readers above with a shared `Env` type.                                  |
| `CloudflareExecutionContext`                     | A minimal public type exposing `waitUntil(promise: Promise<unknown>): void`.     |

These are typed readers, not validators or a separate source of bindings.
The core reader rules for missing Context, runtime validation, and browser-visible output also apply here.

## Inspect the shared WorkersRequestContext {#context}

Use this reference when you need the underlying Context value or its type rather than an individual reader.
`createFetchHandler` supplies one `WorkersRequestContext` containing the values passed by the host:

| Field              | Type               | Value                                          |
| ------------------ | ------------------ | ---------------------------------------------- |
| `env`              | `Env`              | The host's environment variables and bindings. |
| `executionContext` | `ExecutionContext` | The host's execution context for this request. |
| `request`          | `Request`          | The original Web Request.                      |

The module exports both a type and a value named `WorkersRequestContext`:

```typescript
import { WorkersRequestContext } from "@effront/core/workers";
// A type with the same name is also exported.
// WorkersRequestContext<Env, ExecutionContext>
//   readonly env: Env
//   readonly executionContext: ExecutionContext
//   readonly request: Request
```

The value is an Effect `Context.Reference` for `WorkersRequestContext<unknown, unknown>`.
Both core and Cloudflare readers access this same reference rather than constructing a separate request Context.
Its default behavior is to throw a `TypeError` if no value has been provided, so reading the reference directly has the same request-context requirement as using a reader.
