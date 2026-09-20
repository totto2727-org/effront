`Application` from `@effront/core` combines routes and a service Layer into an application definition, separate from the host that serves it.

## Application definition example {#example}

```tsx
import { Application } from "@effront/core";
import { Effect } from "effect";

const EFFRONT = Application.effront();
const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="en">
        <head>
          <title>Example</title>
        </head>
        <body>{children}</body>
      </html>,
    ),
});
const Home = EFFRONT.Page.make({
  render: () => Effect.succeed(<h1>Home</h1>),
});

export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/", Home),
});
```

The result maps `/` to `Home` but does not start a server.
A [host adapter](../platforms.md) serves the definition.

## Application.effront {#identity}

`Application.effront<Services = never>()` takes no runtime arguments and returns an `EFFRONT` factory.
`Services` declares the services the application Layer must provide.

For definitions in separate modules, export one shared factory:

```typescript
import { Application } from "@effront/core";

export const EFFRONT = Application.effront();
```

Each call creates a distinct identity, even when its service types match.
Mixing Routes, Page, Layout, Loading, or Middleware definitions from different identities throws `TypeError`.
The factory exposes [rendering factories](./components.md), [Routes and Middleware](./routing.md), and [ServerFn](./server-functions.md).

## EFFRONT.make {#make}

`EFFRONT.make({ routes, layer? })` returns `ApplicationDefinition<Services, ApplicationError, Requirements>`.

| Option   | Contract                                                                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `routes` | Same-identity Routes with a Layout directly on the root and at least one Page in the tree. A nested Layout alone is insufficient.                                |
| `layer`  | `Layer.Layer<Services, ApplicationError, HttpRouter.HttpRouter \| Requirements>`. Required unless `Services` is `never`. Defaults to `Layer.empty` when omitted. |

`ApplicationError` is the Layer's construction error type.
`Requirements` retains its external service requirements.
The HTTP handler supplies `HttpRouter.HttpRouter`, so a Layer can register custom HTTP routes even when `Services` is `never`.

The Layer is acquired for each request, not when `make` is called.
The host must retain its request Scope until the response body completes, fails, or is cancelled.

[Native HTTP](./http.md) preserves external requirements for the host to supply.
[Workers Fetch](./workers.md) accepts only requirements satisfiable by `HttpRouter` and `HttpServerRequest`.
`makeHttpEffect` and the [Alchemy adapter](./alchemy.md) can capture host-owned service references without extending their lifetimes.

## EFFRONT.withMiddleware {#middleware}

`EFFRONT.withMiddleware(middleware)` returns derived factories with the same identity and `make` function.
It does not modify the original factory.
The derived factories add the middleware's provided services to their available services.

| Definition made with the derived factory | Middleware behavior                                               |
| ---------------------------------------- | ----------------------------------------------------------------- |
| `Routes`                                 | Activates the middleware for the route group.                     |
| `Page`, `Layout`, `Component`            | Requires the middleware scope to be active. Does not activate it. |
| `ServerFn`                               | Applies the captured middleware chain when invoked.               |

The middleware must have the same identity, and its required services must already be available to the factory.
A foreign middleware or the same middleware twice in one chain throws `TypeError`.
See [Routes and Middleware](./routing.md) for handler inputs and execution order.
