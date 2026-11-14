`@effront/core/http` exposes native Effect HTTP handlers with typed failures and external service requirements.

## HTTP boundaries {#fetch}

| API                                               | Result                                                  | Host-supplied services                                                                      |
| ------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `toHttpEffect(application)`                       | A native HTTP Effect                                    | Live request, Scope, and external application requirements                                  |
| `makeHttpEffect(application)`                     | An Effect that constructs a native HTTP Effect          | External services at construction. Live request and Scope at execution                      |
| [`createFetchHandler(application)`](./workers.md) | `(request, env, executionContext) => Promise<Response>` | Fetch context. The application Layer may require only `HttpRouter` and `HttpServerRequest`. |

Ready-made native hosts are available through [Node.js / Bun](./server.md) and [Alchemy](./alchemy.md).
Run rendering and HTTP handlers in the host's dedicated RSC entry.
Importing the handler in plain Node does not supply the RSC runtime.

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

Effront does not impose transport body-size limits.
Configure optional request limits in application middleware or the host.

## makeHttpEffect {#capture}

`makeHttpEffect(application)` returns a construction Effect with no typed failure.
It requires the application's external services and returns a reusable HTTP Effect with those service references captured.
The returned Effect retains the HTTP error channel and still requires the live request and request Scope.
The application Layer remains request-scoped.

- Live request services take precedence over captured services with the same key.
- Construction-time Scope, HTTP request services, router services, and Layer memoization state are excluded from capture.
- Capture does not acquire services or extend their lifetime. Their owner must retain them through every response body that uses them.
- Request completion does not dispose of host-owned captured services.

The [Alchemy adapter](./alchemy.md) accepts a native application-source Effect with the same capture and lifetime rules.
Its source runs per request and retains typed failures and service requirements.
