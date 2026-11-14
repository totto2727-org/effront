`@effront/core/http` exposes native Effect HTTP handlers with typed failures and external service requirements.

## HTTP boundaries {#fetch}

| API                                               | Result                                                  | Host-supplied services                                                                      |
| ------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `toHttpEffect(application)`                       | A native HTTP Effect                                    | Live request, Scope, and external application requirements                                  |
| [`createFetchHandler(application)`](./workers.md) | `(request, env, executionContext) => Promise<Response>` | Fetch context. The application Layer may require only `HttpRouter` and `HttpServerRequest`. |

Ready-made native hosts are available through [Node.js / Bun](./server.md) and [Alchemy](./alchemy.md).

## toHttpEffect {#handler}

```typescript
import { toHttpEffect } from "@effront/core/http";
import application from "./entry.effront";

export const handler = toHttpEffect(application);
```

The input is an `ApplicationDefinition<Services, ApplicationError, Requirements>`.
The result is `HttpApplicationEffect<ApplicationError, Requirements>`, exported from `@effront/core/http`.
Creating the Effect does not run it or start a listener.

| Channel  | Contract                                                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------------------------- |
| Success  | `HttpServerResponse.HttpServerResponse`                                                                                    |
| Error    | Application and HTTP route errors, rendering and Server Function failures, `PlatformError`, and HTTP errors                |
| Services | `HttpServerRequest.HttpServerRequest`, `Scope.Scope`, and the application's remaining external and HTTP route requirements |

Each execution acquires the [application Layer](./application.md#make) for the current request.
**The host must keep the request Scope alive until the body completes, fails, or is canceled.**
An `Effect.scoped` block around response production alone can release services before a streaming body finishes.
HEAD responses have an empty body but retain response metadata.

The handler returns `413` for negative `Content-Length` values, values that are not safe integers, or values greater than 10 MiB.
It does this before it acquires application services.
Server Function POST requests also enforce a 10 MiB limit on received bytes, even without that header.
Custom HTTP route bodies without `Content-Length` are not universally measured by this handler.

## Native service provision {#provision}

> [!WARNING]
> Breaking migration: replace `makeHttpEffect(application)` with `toHttpEffect(application)` and remove the construction `yield*` or execution step.
> Replace Alchemy's `makeApplicationHttpEffect` with `applicationHttpEffect`, also without yielding or executing it to obtain a handler.
> Replace `{ context }` options with `Effect.provideService` or `Effect.provide` and a Layer.
> These APIs are removed, with no deprecation wrappers. Service precedence follows native Effect provision, not a special ambient-request override rule.

Provide external application services directly to `toHttpEffect(application)` with native `Effect.provideService` or `Effect.provide` and a Layer.
The handler is already an HTTP Effect, not a construction Effect that returns one.
It does not take a Context snapshot or merge a stored runtime into requests.

```typescript
const handler = toHttpEffect(application).pipe(Effect.provideService(CacheClient, cache));
```

The host supplies the live request and Scope.
Effront builds the application Layer fresh for each request, with a fresh Layer memo map.
Providing a shared service does not transfer its ownership or extend its lifetime.
Its owner must keep it alive through every response body that uses it.
A scoped external Layer provided around the handler can finalize when headers are produced, before the body finishes.
Put request-owned disposable resources in the application Layer passed to `EFFRONT.make`, whose lifetime follows the response stream.
The [Alchemy adapter](./alchemy.md) supports the same native provision with deferred application loading.
