Build routed pages from reusable React UI, add a shared layout, and show a fallback while content loads.
This reference helps you choose the appropriate rendering factory and then customize route parameters or page transitions without changing the rest of the page structure.

## Choose a rendering factory {#render}

Choose the factory according to where you will use its result.
All four factories are available on `EFFRONT` and on the value returned by `EFFRONT.withMiddleware(...)`.

| Factory                      | Callback contract                                                                         | Use the result                              |
| ---------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------- |
| `Component.make({ render })` | `render(props)` returns an Effect, with a props type you define.                          | Place the async component in JSX.           |
| `Page.make({ render })`      | `render()` returns an Effect, or `render({ params })` when a `params` Schema is provided. | Register the definition with `Routes.page`. |
| `Layout.make({ render })`    | `render({ children })` returns an Effect, with `children` typed as `Awaited<ReactNode>`.  | Pass it as `layout` to `Routes.make`.       |
| `Loading.make({ render })`   | `render()` returns `Awaited<ReactNode>` synchronously.                                    | Pass it as `loading` to `Routes.make`.      |

For Component, Page, and Layout, the full return type of `render` is `Effect.Effect<Awaited<ReactNode>, E, AvailableServices>`.
`E` is your error type, and `AvailableServices` consists of the application services and the services supplied by the applied middleware.
Loading is the synchronous exception: it must not return an Effect or a Promise.

These snippets assume that `Effect` and `Schema` are imported from `effect`, and that `EFFRONT` comes from your shared application module.
Use Component for UI that you want to compose in JSX, and Page for the definition that connects that UI to a route:

```tsx
const Greeting = EFFRONT.Component.make({
  render: ({ name }: { readonly name: string }) => Effect.succeed(<p>こんにちは、{name}</p>),
});
const Home = EFFRONT.Page.make({
  render: () => Effect.succeed(<Greeting name="太郎" />),
});
```

`Greeting` accepts ordinary props, while `Home` must be registered with `Routes.page` rather than rendered as `<Home />`.
For a child route group that needs no additional layout, `EFFRONT.Routes.make().page("/", Home)` is enough to register the Page.
Mount a group without a Layout under the application's root Routes, which must define a Layout as described in [Application make](./application.md#make).
The next section adds a layout and loading UI to that same Page.

## Add a shared layout and loading UI {#loading}

Attach a Layout to Routes when its surrounding UI should be shared by the routes in that group.
Attach Loading at the same scope to provide the Suspense fallback for its content.

```tsx
const SectionLayout = EFFRONT.Layout.make({
  render: ({ children }) => Effect.succeed(<section>{children}</section>),
});
const Pending = EFFRONT.Loading.make({
  render: () => <p role="status">読み込み中…</p>,
});
const section = EFFRONT.Routes.make({
  layout: SectionLayout,
  loading: Pending,
}).page("/", Home);
```

The Layout wraps the content, including the Loading fallback when it is shown.
Return immediately available UI from Loading, and put asynchronous rendering work in a Component, Page, or Layout instead.
A root Layout can provide the HTML document structure, while Layouts on nested Routes provide the shared UI inside it.

## Decode URL parameters for a Page {#params}

A static path uses a Page without `params`.
For a parameterized path, supply a Schema that converts the URL values into the values your Page needs:

```tsx
const Article = EFFRONT.Page.make({
  params: Schema.Struct({ id: Schema.FiniteFromString }),
  render: ({ params }) => Effect.succeed(<h1>記事 {params.id}</h1>),
});
const routes = EFFRONT.Routes.make().page("/articles/:id", Article);
```

The Schema decodes the URL string before `render` receives it, so `params.id` is a `number` in this example.
Like the earlier no-layout example, this `routes` value is a child group to mount under root Routes with a Layout.
The Page and its registered path must agree on the following contract:

- The Schema's Encoded keys must match the path parameter names exactly, without missing or extra keys.
- The encoded value for each parameter must accept a URL string.
- The Schema must have a known, nonempty set of keys.
  An empty-key Schema or a Record with arbitrary string keys does not meet this requirement.

## Configure page transitions {#view-transition}

Effront uses `ViewTransition` from stable React 19.3 to animate Page changes.
The Page is inside the transition boundary, while shared Layouts remain outside it.
Configure the application default once, then override it only on Pages that need different behavior.

Import `PageViewTransition` from `@effront/core` and `Layer` from `effect`.
`PageViewTransition` is an Effect context with a default value.
Add `Layer.succeed(PageViewTransition, config)` to your application's Layer to supply shared settings.

| Scope                       | Configuration                                   |
| --------------------------- | ----------------------------------------------- |
| Application default         | `Layer.succeed(PageViewTransition, config)`     |
| Override for one Page       | `Page.make({ viewTransition: config, render })` |
| Disable one Page's boundary | `Page.make({ viewTransition: false, render })`  |

Only the specified properties in a Page's `config` override the shared settings.
The available properties are:

| Property                                      | Accepted value                                                                                        |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `enabled`                                     | Boolean, enabled by default (`false` removes the boundary).                                           |
| `default`, `enter`, `exit`, `update`, `share` | A React ViewTransition class name, `"auto"`, `"none"`, or a mapping from transition types to classes. |

A mapping is replaced as a whole, not merged with the corresponding shared mapping.
For example, a Page's `default` mapping replaces the application-wide `default` mapping.
If you want to retain existing entries when adding a transition type, include them in the replacement mapping.
The [page transition guide](/en/advanced/client-navigation#transition-scope) shows this configuration and how to apply transition types to links.

Use only the serializable settings listed above because the config crosses from the server to the client.
Callbacks belong on your own React `ViewTransition` boundary, not in this config.
For your own boundary, use React's automatic name or another name, since `effront-page` is reserved for the framework.

A Page can re-enable its boundary with `enabled: true` even if the application sets `enabled: false`.
Changing `enabled` while a Page is displayed can reset its local state because the boundary is added or removed.
Keep state that must survive these changes in a shared Layout.
The operating system's reduced-motion preference is handled differently: changing that preference retains the boundary and preserves input state within the Page.
