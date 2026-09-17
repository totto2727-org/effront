# Core API

This guide describes the application-facing exports of `@effront/core` and its explicit HTTP and Workers subpaths.
Use the [README Usage](../README.md#usage) for a complete minimal page and Fetch entry.

## Application identity and definition

`Application.effront<Services = never>()` creates an identity and its `Component`, `Page`, `Layout`, `Loading`, `Routes`, `Middleware`, and `ServerFn` factories.
Share that value between application modules.
`withMiddleware(middleware)` returns another factory set with the same identity and an extended middleware chain; it does not mutate the original.
Mixing identities, repeating middleware in one scope, or supplying invalid route wiring throws `TypeError`.

`EFFRONT.make({ routes, layer? })` produces an `ApplicationDefinition<Services, ApplicationError, Requirements>` rather than starting a server.
The root Routes must have its own Layout and at least one page.
The application Layer supplies `Services`; it is optional only when `Services` is `never`, in which case omission uses `Layer.empty`.
External Layer requirements remain visible to native HTTP hosts instead of being erased.
The application acquires its Layer once per request.
Streaming request resources remain live until body completion, failure, or cancellation, while buffered responses can release them after response construction.

```ts
import type { ApplicationRequirements, ApplicationServices } from "@effront/core";
import application from "./entry.effront";

type Services = ApplicationServices<typeof application>;
type HostRequirements = ApplicationRequirements<typeof application>;
```

`ApplicationServices<Application>` extracts the application's service type.
`ApplicationRequirements<Application>` extracts external requirements excluding the runtime-owned `HttpRouter.HttpRouter`.
`ApplicationDefinition` is the exported host-integration contract; applications normally infer it from `make`.

## Pages, components, layouts, and loading

These factories are properties of the shared `EFFRONT` value, not separate package exports.
Render callbacks for Page, Component, and Layout return an Effect containing a React node and can use application services plus services supplied by their middleware scope.

| Factory                                          | Contract                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `Page.make({ render, viewTransition? })`         | A static routed Page whose render callback takes no arguments.                                |
| `Page.make({ params, render, viewTransition? })` | A parameterized Page whose `params` Schema decodes route strings before `render({ params })`. |
| `Component.make({ render })`                     | An async React component with inferred props and an Effect render callback.                   |
| `Layout.make({ render })`                        | An async component receiving `{ children }`; shared layouts retain state during navigation.   |
| `Loading.make({ render })`                       | A synchronous React fallback; its callback does not return an Effect or Promise.              |

For example, render a greeting using a decoded route parameter and a reusable component:

```tsx
import { Application } from "@effront/core";
import { Effect, Schema } from "effect";

const EFFRONT = Application.effront();
const Greeting = EFFRONT.Component.make({
  render: ({ name }: { name: string }) => Effect.succeed(<h1>Hello, {name}!</h1>),
});
const Person = EFFRONT.Page.make({
  params: Schema.Struct({ name: Schema.String }),
  render: ({ params }) => Effect.succeed(<Greeting name={params.name} />),
});
const Pending = EFFRONT.Loading.make({ render: () => <p>Loading greeting…</p> });
const Document = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="en">
        <body>{children}</body>
      </html>,
    ),
});

export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: Document, loading: Pending }).page("/people/:name", Person),
});
```

A request to `/people/Ada` renders `Hello, Ada!`.
The parameter Schema must have explicit named keys matching the route's parameter names, with string-compatible encoded values.
Invalid decoded inputs fail before the Page render callback.

## Routes and middleware

`Routes.make({ layout?, loading? })` creates an immutable route builder.
`.page(path, page)` adds a literal, `:parameter`, or terminal `*parameter` route.
A terminal catch-all captures the remaining decoded path, including the empty string at its prefix.
Consequently `/manual` conflicts with `/manual/*path`.
Route patterns with the same matcher shape also conflict, even when their parameter names differ.
`.mount(prefix, routes)` adds a nonempty child route group beneath a static prefix; parameterized mount prefixes are not supported.
The `/_effront` namespace is reserved for the framework, including route patterns that can match it.

```ts
const people = EFFRONT.Routes.make().page("/:name", Person);
const routes = EFFRONT.Routes.make({ layout: Document }).mount("/people", people);
```

`Middleware.make<Config>(handler)` wraps an HTTP Effect.
Its optional type-level `{ provides: Service }` contract identifies services supplied to downstream rendering and Server Functions.
Apply it with `EFFRONT.withMiddleware(middleware)`, then create the scoped members using the returned factories.
The handler preserves downstream errors and can inspect or modify the HTTP response.

```ts
import { Effect } from "effect";
import { HttpServerResponse } from "effect/unstable/http";

const Header = EFFRONT.Middleware.make((response) =>
  response.pipe(Effect.map(HttpServerResponse.setHeader("x-app", "greeting"))),
);
const Scoped = EFFRONT.withMiddleware(Header);
```

Pages created with `Scoped.Page` run under this middleware and return the `x-app: greeting` header.

## Server Functions

`ServerFn.make({ input, handler })` creates a React Server Function whose input Schema validates encoded arguments before its Effect handler runs in the active request.
`input` accepts one Schema for a unary function or a tuple of Schemas for positional arguments.
Use a separate `"use server"` module and the same shared application identity as your routes:

```ts
"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";

export const greet = EFFRONT.ServerFn.make({
  input: Schema.String,
  handler: Effect.fn("greet")(function* (name) {
    return `Hello, ${name}!`;
  }),
});
```

Calling the transformed client reference with `await greet("Ada")` returns `Hello, Ada!` through React's Server Function transport.
A direct call in the server graph is a wiring error and rejects with `TypeError`; share an ordinary Effect function separately if server code also needs the operation.
Input and handler failures flow through the framework's Server Function response handling.

## Page transitions

`PageViewTransition` is a request-local Effect reference exported from `@effront/core`.
`PageViewTransitionConfig` contains `enabled` and the serializable React transition-class settings `default`, `enter`, `exit`, `share`, and `update`.
Provide application settings through the application Layer:

```ts
import { PageViewTransition } from "@effront/core";
import { Layer } from "effect";

const transitions = Layer.succeed(PageViewTransition, { default: "page-fade" });
```

Pass this Layer to `EFFRONT.make({ routes, layer: transitions })`, merging it with other application services when needed.
A Page's `viewTransition` setting overrides application settings property by property; transition-type maps replace, rather than deep-merge with, previous maps.
`Page.make({ viewTransition: false, render })` disables its boundary.
`viewTransition: { enabled: true }` can re-enable an application opt-out.
Default transitions suppress HMR and user-agent visual-transition animations.
Reduced-motion preferences suppress framework page animations while retaining the mounted boundary and input state.
Changing `enabled` explicitly can add or remove the boundary and reset page-local state.
Only serializable settings cross Flight, not animation callbacks.
Custom transition classes need CSS supplied through your application's styling integration.

## Native Effect HTTP

Import `toHttpEffect`, `makeHttpEffect`, and the `HttpApplicationEffect<ApplicationError, Requirements>` type from `@effront/core/http`.

- `toHttpEffect(application)` handles the current `HttpServerRequest` in a host-owned Scope, keeping application errors and external requirements visible in its Effect type.
- `makeHttpEffect(application)` is a construction Effect returning a reusable handler after capturing external service references.
- `HttpApplicationEffect` describes the resulting Effect HTTP response, error union, and request/host requirements.

```ts
import { toHttpEffect, makeHttpEffect } from "@effront/core/http";
import application from "./entry.effront";

const directHandler = toHttpEffect(application);
const constructHandler = makeHttpEffect(application);
```

Give `directHandler` to a host that supplies the request and retains its Scope through streaming response completion.
Alternatively, evaluate `constructHandler` with the application's construction capabilities and hand its result to that host.
These APIs do not create another Effect runtime or acquire service lifetimes during capture.
Live request services override captured references; construction-time HTTP services, Scope, and Layer memo map are not restored.
Do not wrap response production alone in `Effect.scoped`, because producing headers does not consume a streaming body.

A declared `Content-Length` that is invalid or exceeds 10 MiB receives a 413 response.
HEAD returns an empty body while retaining response metadata.
The [experimental Alchemy adapter](../../alchemy/README.md#usage) provides a concrete native host with deferred RSC application loading.

## Fetch and request context

`@effront/core/workers` exports:

| Export                                                                       | Purpose                                                                                                                                                     |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createFetchHandler(application)`                                            | Return a `(request, env, executionContext) => Promise<Response>` handler for an application whose external requirements are satisfied by the Fetch runtime. |
| `FetchHandler<Env = unknown, ExecutionContext = unknown>`                    | The corresponding Web host function type.                                                                                                                   |
| `WorkersRequestContext<Env, ExecutionContext>`                               | The `{ env, executionContext, request }` value type and its shared Effect Context reference.                                                                |
| `createWorkersContextAccessors<Env = unknown, ExecutionContext = unknown>()` | Return typed `getWorkersEnv()` and `getWorkersRequestContext()` Effects without creating another Layer.                                                     |
| `getWorkersEnv<Env = unknown>()`                                             | Read the current environment directly.                                                                                                                      |
| `getWorkersRequestContext<Env = unknown, ExecutionContext = unknown>()`      | Read all current host values directly.                                                                                                                      |

```ts
import { createWorkersContextAccessors } from "@effront/core/workers";
import { Effect } from "effect";

type Env = { APP_LABEL: string };
type HostContext = { requestId: string };
const { getWorkersEnv, getWorkersRequestContext } = createWorkersContextAccessors<
  Env,
  HostContext
>();

export const requestLabel = Effect.gen(function* () {
  const env = yield* getWorkersEnv();
  const { executionContext } = yield* getWorkersRequestContext();
  return `${env.APP_LABEL}: ${executionContext.requestId}`;
});
```

During a Fetch request with `{ APP_LABEL: "Greeting" }` and `{ requestId: "42" }`, this Effect returns `Greeting: 42`.
Accessors share the same core request Context and preserve object identity.
Generic types describe host values but do not validate them.
Reading outside an active Fetch context throws a wiring `TypeError`.
The framework never implicitly serializes environment or execution-context objects into Flight or HTML.
Use the [Cloudflare Env-only accessors](../../cloudflare/README.md#api) when the host execution context is Cloudflare's `waitUntil` contract.

## Integration entry points and support

The main `@effront/core` runtime export requires the `react-server` condition.
Only the RSC graph resolves that condition; SSR and browser code use their separate entry points.
`@effront/core/internal/client-entry` and `@effront/core/internal/ssr-entry` are reserved for matching integration packages, not application authoring.
The current implementation relies on the Vite RSC runtime protocol, so alternative bundlers require additional integration.
See [host support](../../../docs/WORKERS.md) for the tested boundaries and [the roadmap](../../../docs/ROADMAP.md) for deferred adapters.
