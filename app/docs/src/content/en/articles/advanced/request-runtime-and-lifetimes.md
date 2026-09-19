A connection used by a delayed component must stay open while that component is still rendering, even if the HTTP handler has already returned a Response.
Attach resource acquisition and cleanup to the request so that streamed rendering can finish without using a resource that has already been closed.
This guide explains where to register that cleanup, how to use the resource in your application, and what to preserve when adding custom response handling.

## Let the response body determine when cleanup runs {#response-lifetime}

For a streamed response, returning headers and finishing the body are separate events.
Suspense content and Flight data may still be produced after a Fetch handler's Promise resolves to a Response.
Treat that Response as an ongoing operation, not a signal to close its resources.

Effront retains resources acquired by the application Layer for the lifetime of the response body:

- While the body is being read, the request resources remain available.
- When body reading completes, fails, or is cancelled, the request scope closes and runs registered cleanup.
- If there is no body, or producing the response fails, acquired request resources are released without waiting for a stream.

Registering cleanup with the request gives you the same release path for success and interruption.
You do not need a separate success callback and disconnect handler for each application resource.

## Register acquisition and release in the application Layer {#request-layer}

To make a resource available throughout a request:

1. Expose the operations your application needs through an Effect service and include it in `Application.effront<Services>()`.
2. Build that service in a Layer, pairing resource acquisition with release using `Effect.acquireRelease` or an equivalent scoped operation.
3. Pass the Layer to `EFFRONT.make({ routes, layer })` so Effront builds it while handling the request.

The [service setup example](/en/guide/effect#service) shows the service declaration and application wiring.
Place request-specific acquisition inside the Layer rather than opening a resource at module load time and retaining it for later requests.

The application Layer is built per request on Node.js, Bun, Cloudflare Workers, and Alchemy.
Creating a reusable handler with `createFetchHandler` does not turn that Layer into a server-wide singleton.

On Workers, Layer acquisition can read the current request's `env`, execution context, and original `Request`.
Use the [Workers context accessors](/en/platforms/cloudflare#context) when those values are needed to construct your service.

## Use request services in pages and Server Functions {#render-scope}

Read the service from the Effect in a Page, Layout, Component, or Server Function instead of acquiring the same request resource separately at each call site.
Effront supplies the application services for the request being handled.
A delayed render can therefore continue using them while the response is streaming.

Keep that work inside Effront's request handling by rendering through the application's Routes.
The rendering Scope belongs to that request and is not shared with another request.
When the render stream is aborted, unfinished rendering work is interrupted as well.
Rendering outside the application's request runtime, or without a required Middleware being active, produces a `TypeError` rather than a usable service context.

Only send deliberately public values from your services to the browser.
Workers bindings are not automatically serialized into Flight or HTML, but values you put in JSX, Client Component props, or Server Function results can be sent to the client.

## Customize response handling without closing resources early {#resource-design}

If you wrap a Fetch handler, return its body with streaming and cancellation preserved.
Do not close request resources in a `finally` block that runs as soon as the handler returns a Response: later body reads may still need them.
Similarly, a custom native HTTP integration must retain its request Scope through body completion, failure, or cancellation rather than applying `Effect.scoped` only around response creation.

If you supply host-owned services from outside the application Layer, their owner must keep them alive while requests use them.
`makeHttpEffect` captures references to those services, but does not acquire them or extend their lifetime.
They remain separate from the application Layer that Effront builds for each request.

Work that must outlive a response needs a host-supported background-work mechanism and resources owned by that work.
Starting a Promise or saving a request service in an outer variable does not keep that service alive after request cleanup.
