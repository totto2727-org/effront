An HTTP host needs two things from your application: a way to handle the current request and a clear contract for the services that request can use.
The native APIs in `@effront/core/http` provide that contract as an Effect, so the host can supply external services without losing the application's error and requirement types.
This reference helps you choose the connection, run the handler, and keep its services available while a response streams.

## Choose the host boundary {#fetch}

Start with the interface your host expects.
For an existing integration, see [Node.js / Bun serve](./server.md), [Workers Fetch](./workers.md), or the [Alchemy adapter](./alchemy.md).
When connecting an application yourself, choose between these boundaries:

| Host interface               | API                                               | What the host receives                                                 |
| ---------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| Native Effect HTTP           | `toHttpEffect` from `@effront/core/http`          | An Effect with a typed error channel and external service requirements |
| Workers-compatible Web Fetch | `createFetchHandler` from `@effront/core/workers` | A `(request, env, executionContext) => Promise<Response>` function     |

`createFetchHandler` makes the supplied `env` and `executionContext` available within each request.
It accepts applications whose external requirements can be satisfied by `HttpRouter` and `HttpServerRequest`, not applications requiring arbitrary additional services from the host.
If your application needs those additional services, use native HTTP and provide them at request time, or capture them during host construction as described below.

## Handle a request with toHttpEffect {#handler}

Pass your application definition to `toHttpEffect` to create a reusable handler Effect.
The following code prepares the handler without running it or starting a server:

```typescript
import { toHttpEffect } from "@effront/core/http";
import application from "./entry.effront";

export const handler = toHttpEffect(application);
```

For each request, the host runs `handler` with the current `HttpServerRequest`, a request `Scope`, and any remaining external services required by the application or its HTTP routes.
The application's own services are built from its Layer for that request, even when the host reuses the same handler.
Declare that Layer and its dependencies through [Application make](./application.md#make).

The handler has type `HttpApplicationEffect<ApplicationError, Requirements>`, exported from `@effront/core/http`.
Its success value is an `HttpServerResponse`.
Its error channel includes application and HTTP route errors alongside the framework's rendering, Server Function, platform, and HTTP errors.
Its required services retain the external requirements as well as `HttpServerRequest` and `Scope`, so constructing a handler does not remove the host's obligation to provide them.

A successful handler result can still contain a streaming body that uses request services.
**Keep the request Scope alive until the body ends, fails, or is cancelled.**
Do not wrap only the production of the response in `Effect.scoped`: closing the Scope when headers are ready can release services before the body finishes using them.
The host must manage the complete response lifetime, not just the Effect that produces its headers.

**Request-body limits.**
On native hosts as well as Fetch hosts, `toHttpEffect` checks `Content-Length` and returns `413` for invalid values or values above 10 MiB.
Server Function POST requests also enforce a 10 MiB limit on bytes actually received, even without that header.
This is not a universal body-size limit for custom HTTP routes: the handler does not measure every custom route body that lacks `Content-Length`.

## Capture host services with makeHttpEffect {#capture}

Sometimes the host already has external services available during startup and needs to reuse those references when requests arrive.
In that case, `makeHttpEffect(application)` separates handler construction from request processing.
It returns a construction Effect, not a response-producing Effect directly.

Run that construction Effect with the required external services provided, then give the resulting HTTP Effect to the host.
The host still supplies the live `HttpServerRequest` and request `Scope` each time it runs the returned handler.
The application Layer is built per request, not during capture, and the response lifetime rule above still applies.
The [Alchemy adapter](./alchemy.md) uses this construction boundary for its native Worker integration.

Capture saves service references, but does not acquire the services or extend their lifetime.
**Their owner must keep them alive through every response body that uses them.**
In particular, do not release a captured service merely because handler construction has completed.
Completing an individual request does not dispose of these host-owned services.

Request-specific state is deliberately separate from captured references.
The construction-time Scope, HTTP request services, and Layer memoization state are not restored for later requests.
When a live request supplies the same service as the captured context, the live request's value takes precedence.
