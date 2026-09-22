Let Effront manage resources needed by one request.
Give shared resources and background work separate owners.

## Choose the resource owner {#resource-design}

| Resource use                              | Owner                                           | Release point                                         |
| ----------------------------------------- | ----------------------------------------------- | ----------------------------------------------------- |
| One request                               | Request Scope                                   | Streamed-body completion, failure, or cancellation    |
| Several requests, such as a database pool | Host owner outside the application Layer        | After every response that uses the resource has ended |
| Work after the response ends              | Background work, via a host-supported mechanism | When that work finishes                               |

For a shared database pool, register each borrowed connection's return with the request Scope.
Leave pool disposal to the host owner.
See the [external-service ownership contract](/en/api-reference/http#capture) for host-provided services.

> [!NOTE]
> A detached Promise does not extend a request service's lifetime.
> Give background work its own resources.

## Acquire request resources in the application Layer {#request-layer}

Effront builds the Layer passed to `EFFRONT.make({ routes, layer })` for each request.
Place request-specific acquisition in `Layer.effect` and register cleanup with `Effect.acquireRelease`.
The [service setup example](/en/guide/effect#service) shows how to declare a service and register its Layer.

> [!WARNING]
> Create request-specific mutable state during acquisition.
> A reused `Layer.succeed(Service, object)` supplies the same object across requests.

## Keep resources alive through the response body {#response-lifetime}

<span id="render-scope"></span>

A delayed component can still use request services after the handler returns a `Response`.
Let the request Scope run the registered cleanup when the streamed body ends.
For buffered or empty responses, or if response creation fails, Effront releases acquired resources without waiting for body consumption.

> [!WARNING]
> Do not close request-owned resources in a `finally` block around the handler call.
> An `Effect.scoped` block around response creation alone also releases resources before the streamed body finishes.
> For custom HTTP hosts, follow the [request Scope and response-body contract](/en/api-reference/http#handler).
