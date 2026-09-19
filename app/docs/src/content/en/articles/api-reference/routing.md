Use `Routes` to decide which Page handles each URL and to compose sections that share a Layout or Loading UI.
Add scoped `Middleware` when a section also needs request handling, such as authentication or a service supplied to its Pages.
This reference covers how to assemble those definitions and the contracts to check when a route or Middleware cannot be registered.

## Register and compose routes {#routes}

Build a route group by chaining `page`, then use `mount` to place it beneath a shared URL prefix.
For example, an article section can declare its own index and detail paths without repeating `/articles`:

```typescript
const articles = EFFRONT.Routes.make().page("/", ArticleIndex).page("/:id", Article);
const routes = EFFRONT.Routes.make({ layout: RootLayout })
  .page("/", Home)
  .mount("/articles", articles);
```

Here, `Home`, `ArticleIndex`, `Article`, and `RootLayout` are existing definitions from the shared `EFFRONT`.
`Article` declares a `params` Schema with an input key named `id`.
The resulting registration is:

| URL pattern     | Page           |
| --------------- | -------------- |
| `/`             | `Home`         |
| `/articles`     | `ArticleIndex` |
| `/articles/:id` | `Article`      |

The child's `/` maps to `/articles` itself, not a registered `/articles/` pattern.
Pass the assembled definition to `EFFRONT.make({ routes })` to use it as the application's routes.
The root must contain at least one Page and specify a RootLayout that renders the HTML document.

**Builder methods**

| Method                               | Accepted input                                                 | Result                                                                                    |
| ------------------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `Routes.make()`                      | No arguments.                                                  | Empty Routes without a Layout or Loading, useful for child groups.                        |
| `Routes.make({ layout?, loading? })` | Optional Layout and Loading definitions.                       | Empty Routes with a shared layout and/or Suspense waiting UI.                             |
| `routes.page(path, page)`            | A literal path and a Page with matching parameter names.       | New Routes containing the additional Page.                                                |
| `routes.mount(prefix, child)`        | A static prefix and child Routes containing at least one Page. | New Routes containing the prefixed child paths, preserving nested Layouts and Loading UI. |

`page` and `mount` do not mutate the Routes they are called on.
Use their return values, as in the chained example, rather than calling them and discarding the result.

All Pages, Layouts, Loading definitions, and child Routes must originate from the same `Application.effront()` instance.
Import a shared `EFFRONT` when definitions live in separate modules.
A definition derived with `withMiddleware` still belongs to that application and can be composed with its other definitions.

## Match paths to Page parameters {#paths}

Choose the path pattern and the Page's `params` together.
A static path requires a Page without `params`.
For a dynamic path, the Schema's input keys must exactly match all named parameters, and its input values must accept strings from the URL.
The Page receives the decoded values described in [Page params](/en/api-reference/components#params).

| Pattern         | Match                                                                      | Required Schema input keys |
| --------------- | -------------------------------------------------------------------------- | -------------------------- |
| `/articles`     | One fixed path.                                                            | No `params` Schema.        |
| `/articles/:id` | One segment after `/articles/`.                                            | `id`                       |
| `/manual/*path` | The remaining path, including an empty capture at `/manual` or `/manual/`. | `path`                     |

Use `:name` for a whole segment and `*name` for the whole final segment.
A mount prefix is always static, so put parameters in the child's page paths, not in `mount`'s prefix.

**Choosing a catch-all**

A catch-all is useful when one Page handles an arbitrary depth of content.
For `/manual/*path`, `/manual/a/b` supplies `"a/b"` to the Schema, while `/manual` and `/manual/` supply `""`.
Use an empty-string-compatible Schema such as `Schema.String` if the same Page should also handle that entry point.
The captured value has already been URL-decoded once, so do not URL-decode it again.
Malformed percent encoding, encoded `/` or `\`, and NUL in a catch-all request path produce a 404 response.

**Overlapping registrations**

A catch-all owns its empty-capture path: `/manual/*path` conflicts with `/manual`.
More specific child paths such as `/manual/about` and `/manual/:slug` can coexist with the catch-all and take precedence over it.

Other duplicate patterns are compared without regard to case or parameter names.
For example, `/Articles` conflicts with `/articles`, and `/articles/:id` conflicts with `/articles/:slug`.
Collision checks also apply to the full paths produced by `mount`.

**Registration constraints**

- Supply an absolute path literal beginning with `/`, without a query string or fragment.
- Except for `/` itself, paths cannot end with `/` or contain empty, `.`, or `..` segments.
- The characters `?`, `#`, `%`, `;`, and `\` are not allowed in registered paths.
- Every parameter needs a unique name within its path, and a catch-all must be named and terminal.
- Parameter names cannot contain `:`, `*`, `.`, `-`, or parentheses.
  Use `:userId`, for example, rather than `:user-id`.

`/_effront` is reserved for the framework.
`EFFRONT.make({ routes })` also rejects patterns that could match that namespace, including root-level `/:name` and `/*path`.
Give those routes a static prefix such as `/articles/:name` instead.

## Apply Middleware to a route group {#middleware}

Create a Middleware with `Middleware.make`, derive an `EFFRONT` with `withMiddleware`, and use that derived definition to create the Routes where the Middleware should run.
The following example supplies a service to a Page:

```tsx
import { Context, Effect } from "effect";
import { Application } from "@effront/core";

class RequestLabel extends Context.Service<
  RequestLabel,
  {
    readonly value: string;
  }
>()("example/RequestLabel") {}

const EFFRONT = Application.effront();
const ProvideLabel = EFFRONT.Middleware.make<{ provides: RequestLabel }>((httpEffect) =>
  httpEffect.pipe(Effect.provideService(RequestLabel, { value: "request" })),
);
const Scoped = EFFRONT.withMiddleware(ProvideLabel);
const Home = Scoped.Page.make({
  render: () =>
    Effect.gen(function* () {
      const label = yield* RequestLabel;
      return <h1>{label.value}</h1>;
    }),
});
const scopedRoutes = Scoped.Routes.make().page("/", Home);
```

Mount `scopedRoutes` into a parent Routes with a RootLayout, and its Page displays `request`.
The `Scoped.Routes.make()` call activates the Middleware for the route group.
Creating only `Scoped.Page.make(...)` and registering that Page on the original `EFFRONT.Routes.make()` does not activate it.
Pages, Layouts, and Components consume the provided services when rendered within the active scope.
A Server Function created from `Scoped` applies its own Middleware when invoked.
See the [Middleware guide](/en/guide/middleware) for complete application and Server Function examples.

**Inputs, returns, and service requirements**

| API                                               | Contract                                                                                                                     |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `Middleware.make(handler)`                        | Returns a Middleware definition whose handler takes the downstream HTTP response Effect and returns an HTTP response Effect. |
| `Middleware.make<{ provides: Service }>(handler)` | Declares the service the handler supplies to downstream processing.                                                          |
| `EFFRONT.withMiddleware(middleware)`              | Returns a derived definition without modifying `EFFRONT`, adding the Middleware and its provided services.                   |

`provides` is a generic type declaration, not a runtime service value.
The handler must actually supply that value, as `Effect.provideService` does above.
`withMiddleware` checks at the type level that the Middleware's required services are available, and the Middleware must belong to the same application.

The handler preserves the downstream Effect's error type and remaining service requirements rather than adding its own error type.
To reject a request, convert an authentication failure or similar condition into an HTTP response, such as 401, and return that response instead of running downstream processing.

**Order and reach**

`EFFRONT.withMiddleware(first).withMiddleware(second)` enters `first`, then `second`, then downstream processing.
The response returns through them in reverse order.
Adding the same Middleware twice to the same chain throws a `TypeError`.

Scoped Middleware targets its Routes and Server Functions, not user-defined HTTP, static assets, or unknown routes.
For behavior shared across those requests too, use [global HTTP Middleware](/en/guide/http).
