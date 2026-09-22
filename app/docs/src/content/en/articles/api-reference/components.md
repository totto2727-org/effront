`Component`, `Page`, `Layout`, and `Loading` define rendered content and shared route UI through the [application factory](./application.md#identity).

## Rendering factories {#render}

| Factory                                           | `render` input                                        | `render` output                                           | Result of `make`                                              |
| ------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| `Component.make({ render })`                      | Application-defined props                             | `Effect.Effect<Awaited<ReactNode>, E, AvailableServices>` | Async component used in JSX                                   |
| `Page.make({ render, params?, viewTransition? })` | No arguments, or `{ params }` with decoded parameters | The same Effect type                                      | Definition registered with `Routes.page`, not a JSX component |
| `Layout.make({ render })`                         | `{ children: Awaited<ReactNode> }`                    | The same Effect type                                      | Async component assigned to `Routes.make({ layout })`         |
| `Loading.make({ render })`                        | No arguments                                          | Synchronous `Awaited<ReactNode>`                          | Component assigned to `Routes.make({ loading })`              |

`E` is the render failure type.
`AvailableServices` includes application services and services supplied by the factory's middleware scope.
Loading cannot return an Effect or Promise.

## Layout and Loading {#loading}

A Routes group's Layout wraps its content, including its Loading fallback.
Loading supplies the Suspense fallback at that scope.
This child group uses all four rendering factories:

```tsx
import { Effect } from "effect";
import { EFFRONT } from "./effront";

const Greeting = EFFRONT.Component.make({
  render: ({ name }: { readonly name: string }) => Effect.succeed(<p>Hello, {name}</p>),
});
const Home = EFFRONT.Page.make({
  render: () => Effect.succeed(<Greeting name="Ada" />),
});
const SectionLayout = EFFRONT.Layout.make({
  render: ({ children }) => Effect.succeed(<section>{children}</section>),
});
const Pending = EFFRONT.Loading.make({
  render: () => <p role="status">Loading…</p>,
});
export const section = EFFRONT.Routes.make({
  layout: SectionLayout,
  loading: Pending,
}).page("/", Home);
```

`./effront` exports the application's shared factory.
Mount `section` beneath root Routes with an HTML document Layout as required by [Application make](./application.md#make).

## Page params {#params}

`Page.make({ params, render })` decodes URL strings with `params` before passing its `Type` to `render`.

```tsx
import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";

const Article = EFFRONT.Page.make({
  params: Schema.Struct({ id: Schema.FiniteFromString }),
  render: ({ params }) => Effect.succeed(<h1>Article {params.id}</h1>),
});
export const articles = EFFRONT.Routes.make().page("/articles/:id", Article);
```

Here `params.id` is a number.
`articles` is a child group to mount under root Routes with a Layout.

- A static path requires a Page without `params`.
- A parameterized path requires exactly the Schema's `Encoded` keys, with no missing or extra names.
- Encoded parameter values must accept URL strings.
- The Schema must have known, nonempty string keys. Empty structs and arbitrary-key Records are rejected by the type contract.

## PageViewTransition {#view-transition}

`PageViewTransition` from `@effront/core` is an Effect `Context.Reference<PageViewTransitionConfig>` with built-in defaults.
It configures the Page's React 19.3 ViewTransition boundary, which excludes shared Layouts.

| Configuration                                                        | Scope                                             |
| -------------------------------------------------------------------- | ------------------------------------------------- |
| `Layer.succeed(PageViewTransition, config)` in the application Layer | Application default; import `Layer` from `effect` |
| `Page.make({ viewTransition: config, render })`                      | Overrides specified properties for one Page       |
| `Page.make({ viewTransition: false, render })`                       | Removes that Page's boundary                      |

| Property                                      | Value                                                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `enabled`                                     | Boolean. Defaults to enabled.                                                            |
| `default`, `enter`, `exit`, `update`, `share` | React ViewTransition class name, `"auto"`, `"none"`, or transition-type-to-class mapping |

Built-in `default` classes are `"auto"`, with `"none"` for `hmr-refresh` and `navigation-ua-visual-transition`.
Overrides replace a mapping as a whole, rather than merging its entries.
A Page can set `enabled: true` even when the application disables transitions.

Only serializable settings are accepted, not callbacks.
For a custom React boundary, use an automatic or distinct name: `effront-page` is reserved.
Changing explicit `enabled` on a displayed Page can reset its local state.
Live reduced-motion preference changes retain the boundary and preserve Page input state.
Each Page uses its own configuration, so an enabled outgoing Page can still animate when the destination disables animations.
The Page animation does not cover every later Suspense reveal.
Use a separate [React ViewTransition](https://react.dev/reference/react/ViewTransition) for content that should animate on reveal.

An anchor can add an application transition type:

```tsx
<a href="/photos/2" data-effront-transition-types="photo-next">
  Next photo
</a>
```

| Link transition types | Contract                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scope                 | The attribute adds types for push and replace, not later Back or Forward traversal.                                                                                |
| Class mapping         | A configuration such as `enter: { "photo-next": "photo-fade" }` selects a CSS class. Supply the matching View Transition pseudo-element styles in the application. |
| Reserved names        | `navigation`, `navigation-*`, `server-function`, and `hmr-refresh` are ignored in the attribute.                                                                   |

For Page and application configuration examples, see [Client navigation](/en/advanced/client-navigation#transition-scope).
