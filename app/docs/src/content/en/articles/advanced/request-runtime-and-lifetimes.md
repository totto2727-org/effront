A Fetch handler can return a `Response` while a delayed component is still rendering.
Effront keeps request-scoped resources alive through the response body, not just through the handler call.

## A Response can outlive its handler {#response-lifetime}

Returning headers does not finish a streamed response.
Suspense content and Flight data can still need application services after the handler's Promise resolves.
Effront closes the request Scope and runs registered cleanup when the body finishes, fails, or is cancelled.
If there is no body, or response creation fails, acquired resources are released without waiting for a stream.

This is why closing a connection in a `finally` block around the handler call is too early: later rendering may still use it.

## Application services belong to each request {#request-layer}

The Layer passed to `EFFRONT.make({ routes, layer })` is built per request, including when the host reuses a handler created by `createFetchHandler`.
It is not a server-wide singleton.
Request-specific acquisition belongs inside that Layer, with release registered through `Effect.acquireRelease` or an equivalent scoped operation.
The [service setup example](/en/guide/effect#service) shows the service declaration, `Application.effront<Services>()`, and Layer registration.

On Workers, acquisition can read that request's `env`, execution context, and original `Request` through the [Workers context accessors](/en/platforms/cloudflare#context).
Opening a resource at module load time does not give it this request ownership.

## Delayed rendering uses the same services {#render-scope}

Pages, Layouts, Components, and Server Functions use the application services for the request being handled.
A delayed render does not need to acquire the same resource again while the response is streaming.
Each request has its own rendering Scope.
Aborting the render stream interrupts unfinished rendering work.

Rendering must run through the application's Routes.
Rendering outside its request runtime, or without required Middleware active, produces a `TypeError` rather than a usable service context.

Workers bindings are not automatically serialized into Flight or HTML, but values placed in JSX, Client Component props, or Server Function results can reach the browser.
Only deliberately public values belong in those outputs.

## Request-owned and host-owned resources {#resource-design}

A Fetch wrapper must preserve body streaming and cancellation.
A custom native HTTP integration must retain the request Scope through body completion, failure, or cancellation.
Wrapping only response creation in `Effect.scoped` closes it too early.

Host-owned services supplied outside the application Layer have a different owner.
`makeHttpEffect` captures references to them but neither acquires them nor extends their lifetime.
Their owner must keep them alive while requests use them.
Request cleanup does not dispose them.

Work that must outlive a response needs a host-supported background-work mechanism and resources owned by that work.
Starting a Promise or storing a request service in an outer variable does not extend that service's lifetime.
