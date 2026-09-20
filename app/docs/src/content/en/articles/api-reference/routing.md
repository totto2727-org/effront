`Routes` and `Middleware` belong to the shared `Application.effront()` factory.

## Routes {#routes}

| Method                                | Input                                                   | Result                                                         |
| ------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------- |
| `Routes.make({ layout?, loading? }?)` | Optional same-identity Layout and Loading               | Empty Routes with shared UI and the factory's middleware scope |
| `routes.page(path, page)`             | Absolute path literal and Page with matching parameters | New Routes containing the Page                                 |
| `routes.mount(prefix, child)`         | Static absolute prefix and nonempty child Routes        | New Routes containing the prefixed child paths and nested UI   |

`page` and `mount` do not mutate the original Routes.
All definitions must share an application identity, including those derived with `withMiddleware`.

For example, mounting a child that registers `/` and `/:id` at `/articles` produces `/articles` and `/articles/:id`.
The child's `/` does not produce a registered `/articles/` pattern.
The root passed to `EFFRONT.make({ routes })` must have its own Layout and at least one Page in the tree.

## Route paths {#paths}

| Pattern         | Match                                                                 | Page's Schema `Encoded` keys |
| --------------- | --------------------------------------------------------------------- | ---------------------------- |
| `/articles`     | Fixed path                                                            | No `params` Schema           |
| `/articles/:id` | One segment                                                           | `id`                         |
| `/manual/*path` | Remaining path, including an empty capture at `/manual` or `/manual/` | `path`                       |

Schema keys must exactly match the path's parameter names, and encoded values must accept URL strings.
The Page receives the [decoded values](/en/api-reference/components#params).
Mount prefixes cannot contain parameters.

For `/manual/*path`, `/manual/a/b` supplies `"a/b"` and `/manual` supplies `""`.
An empty-string-compatible Schema such as `Schema.String` permits both.
The capture is URL-decoded once.
Do not decode it again.
Malformed percent encoding in catch-all request paths produces 404.

**Collisions**

- `/manual/*path` also owns `/manual`, so those registrations conflict.
- More specific `/manual/about` and `/manual/:slug` routes can coexist with the catch-all and take precedence.
- Duplicate checks ignore case and parameter names: `/Articles` conflicts with `/articles`, and `/articles/:id` with `/articles/:slug`.
- Mounted paths undergo the same collision checks.

**Registration constraints**

- Paths must be absolute literals beginning with `/`.
- Except for `/`, they cannot end with `/` or contain empty, `.`, or `..` segments.
- `?`, `#`, `%`, `;`, and `\` are forbidden.
- `:name` must occupy a whole segment. `*name` must occupy the final whole segment.
- Names must be nonempty and unique within the path. They cannot contain `:`, `*`, `.`, `-`, or parentheses.
- `/_effront` is reserved. `EFFRONT.make` rejects patterns that could match it, including root `/:name` and `/*path`.

## Middleware {#middleware}

`Middleware.make(handler)` returns a same-identity middleware definition.
The handler receives the downstream HTTP response Effect and returns an HTTP response Effect.
It preserves the downstream error type and remaining service requirements.
A rejection must be an HTTP response, such as 401, rather than an additional typed failure.

`Middleware.make<{ provides: Service }>(handler)` declares a service supplied to downstream processing.
The handler must provide its value at runtime:

```tsx
import { Context, Effect } from "effect";
import { EFFRONT } from "./effront";

class RequestLabel extends Context.Service<RequestLabel, { readonly value: string }>()(
  "example/RequestLabel",
) {}

const ProvideLabel = EFFRONT.Middleware.make<{ provides: RequestLabel }>((httpEffect) =>
  httpEffect.pipe(Effect.provideService(RequestLabel, { value: "request" })),
);
const Scoped = EFFRONT.withMiddleware(ProvideLabel);
const Home = Scoped.Page.make({
  render: () => Effect.map(RequestLabel, ({ value }) => <h1>{value}</h1>),
});
export const scopedRoutes = Scoped.Routes.make().page("/", Home);
```

`./effront` exports the shared factory.
Mount `scopedRoutes` under root Routes with a Layout.
Creating Routes with `Scoped` activates the middleware.
Creating only a scoped Page does not.
Scoped Pages, Layouts, and Components require that active scope.
A scoped Server Function applies its own middleware chain when invoked.

`withMiddleware` requires the middleware's dependencies to be available and adds its provided services to the returned factories.
A different identity or duplicate middleware in one chain throws `TypeError`.
`withMiddleware(first).withMiddleware(second)` enters `first`, then `second`, then downstream processing, and returns in reverse order.

Scoped middleware covers its Routes and Server Functions, not custom HTTP, static assets, or unknown routes.
See [Middleware](/en/guide/middleware) for complete examples and [global HTTP middleware](/en/guide/http) for broader request coverage.
