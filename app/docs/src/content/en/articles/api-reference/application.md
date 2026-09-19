Use `Application` from `@effront/core` to combine a route tree and its application services into the definition your host will serve.
Start with the complete example below, then use the API entries to check required options or add services and middleware.

## A one-route application {#example}

The smallest application has a Page and a Layout on its root Routes.
This definition maps `/` to `Home` and wraps its content in an HTML document.

```tsx
import { Effect } from "effect";
import { Application } from "@effront/core";

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

The default export is an application definition, not a running server.
Connect it to the host described in your [platform guide](../platforms.md) to serve the page.
No `layer` option is needed here because the application declares no services.

## Application.effront: create shared factories {#identity}

`Application.effront<Services = never>()` takes no runtime arguments and returns the factories used to author an application.
Choose `Services` to describe the services you will supply through the `layer` option of `make`, or leave the default `never` when there are none.

```typescript
import { Application } from "@effront/core";

const EFFRONT = Application.effront();
// With application services: Application.effront<MyService>()
```

Use this value to define [pages and layouts](./components.md), [routes and middleware](./routing.md), and [server functions](./server-functions.md).
For definitions in separate files, export `EFFRONT` from a shared module and import it rather than calling `Application.effront()` again.
Each call creates a new identity: matching service types do not make two calls interchangeable.
Mixing Page, Routes, Layout, Loading, or Middleware definitions from different identities throws a `TypeError`.

## EFFRONT.make: supply routes and services {#make}

Call `EFFRONT.make({ routes, layer? })` once you have the route tree you want to serve.

| Option   | Required value                                                                                           |
| -------- | -------------------------------------------------------------------------------------------------------- |
| `routes` | A Routes value from the same identity, with a `layout` directly on it and at least one Page in its tree. |
| `layer`  | An Effect Layer that provides `Services`, required unless `Services` is `never`.                         |

A Layout only on a nested Routes object does not satisfy the root Layout requirement.
Omitting `layer` when `Services` is `never` uses `Layer.empty`.
You can still pass a Layer in that case, for example to register custom HTTP routes without providing application services.

**Layer dependencies.**
The accepted type is `Layer.Layer<Services, ApplicationError, HttpRouter.HttpRouter | Requirements>`.
`Services` is what the Layer provides to your application, whereas `Requirements` is what must be supplied to build that Layer.
`ApplicationError` is its construction error type.
The HTTP handler supplies `HttpRouter.HttpRouter` from `effect/unstable/http`, which the Layer can use to register HTTP routes.

**Return value.**
`make` returns `ApplicationDefinition<Services, ApplicationError, Requirements>`, retaining the Layer's error and external service requirement types for the host connection.
Choose a connection that can satisfy those requirements:

- [Native HTTP](./http.md) preserves the external requirements so your host can provide them.
- [Workers' `createFetchHandler`](./workers.md) accepts applications whose Layer requirements are satisfied by `HttpRouter.HttpRouter` and `HttpServerRequest.HttpServerRequest`, rather than supplying arbitrary external services.
- For services available during host construction, `makeHttpEffect` or the [Alchemy integration](./alchemy.md) can capture references for use by the handler.

**Service lifetime.**
The application Layer is built for each request, not once when `make` is called.
If you write a native HTTP host, keep the request scope alive until the response body finishes, errors, or is cancelled.
Capturing a service reference does not extend its lifetime: its owner must keep it alive through every response body that uses it.

## EFFRONT.withMiddleware: extend selected definitions {#middleware}

Use `EFFRONT.withMiddleware(middleware)` to derive factories for a middleware scope without changing the original `EFFRONT` factories.
Create the route group with the returned `Routes.make()` factory to activate that middleware.
Pages, Layouts, and Components created through the derived factories require that scope to be active rather than activating it themselves.
A Server Function created through the derived factory applies its own middleware chain when invoked.
The result shares the original identity and `make` function, so definitions from both can belong to the same application.

The middleware must come from the same identity, and the factories being extended must already have access to every service it requires.
The returned factories also make the middleware's provided services available to those definitions.
Adding middleware from another identity or adding the same middleware twice in one scope throws a `TypeError`.
See [Routes and Middleware](./routing.md) for middleware definition and placement options.
