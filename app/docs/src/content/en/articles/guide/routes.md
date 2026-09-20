Build pages with `Page`, share their UI with `Layout`, and register their URLs with `Routes`.
Route parameters provide values from the URL, while nested route groups let related pages share a layout and loading UI.

## Register a Page {#pages}

In `src/entry.effront.tsx`, create a Page and a root Layout, then register the Page's URL:

```tsx
import { Application } from "@effront/core";
import { Effect } from "effect";

const EFFRONT = Application.effront();

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="en">
        <body>{children}</body>
      </html>,
    ),
});

const HomePage = EFFRONT.Page.make({
  render: () => Effect.succeed(<h1>Home</h1>),
});

const routes = EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage);

export default EFFRONT.make({ routes });
```

Open `/` to see `Home` where RootLayout renders `children`.
The root Routes must have a Layout and at least one Page.
Keep the default export when replacing `routes` in the following examples.
Calls to `.page()` and `.mount()` return new definitions, so use their return values.

## Read URL parameters {#matching}

Add `Schema` to the `effect` import and define Pages with parameter names matching their route patterns:

```tsx
const ArticlePage = EFFRONT.Page.make({
  params: Schema.Struct({ slug: Schema.NonEmptyString }),
  render: ({ params }) => Effect.succeed(<h1>{params.slug}</h1>),
});

const ManualPage = EFFRONT.Page.make({
  params: Schema.Struct({ path: Schema.String }),
  render: ({ params }) => Effect.succeed(<article>{params.path || "Manual"}</article>),
});

const routes = EFFRONT.Routes.make({ layout: RootLayout })
  .page("/", HomePage)
  .page("/articles/:slug", ArticlePage)
  .page("/manual/*path", ManualPage);
```

- `/articles/hello` displays `hello`.
- `/manual/setup/install` displays `setup/install`.
- `/manual` and `/manual/` supply an empty `path` and display `Manual`.

A named parameter captures one segment.
A terminal catch-all captures the remaining path, including an empty string, and must be last in the pattern.
Do not also register `/manual`, because `/manual/*path` already owns that URL.
More specific paths such as `/manual/about` and `/manual/:section` take precedence over the catch-all.
Renaming a parameter does not create a distinct route: `/articles/:slug` conflicts with `/articles/:id`.
Keep `/_effront` and patterns that could match it reserved.

Schemas receive URL-decoded strings and pass their decoded values to `render`.
Use [Effect Schema](https://effect.website/docs/schema/introduction/) to validate or transform them.
For GET and HEAD, a decoding failure returns 404 before rendering, including during client navigation.
Unregistered URLs also return 404.
A parameter Schema can use services supplied by the route's Middleware.

If parameter decoding fails during the page refresh after a Server Function POST, the action's result is preserved and rendering fails through React's error handling.
Do not retry a mutation merely because the refreshed page failed.

## Add a section layout and loading UI {#mount}

Define a child Routes group and mount it at a fixed prefix:

```tsx
const ArticleLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <section>
        <h1>Articles</h1>
        {children}
      </section>,
    ),
});

const ArticleLoading = EFFRONT.Loading.make({
  render: () => <p>Loading article…</p>,
});

const articles = EFFRONT.Routes.make({
  layout: ArticleLayout,
  loading: ArticleLoading,
}).page("/:slug", ArticlePage);

const routes = EFFRONT.Routes.make({ layout: RootLayout })
  .page("/", HomePage)
  .page("/manual/*path", ManualPage)
  .mount("/articles", articles);
```

At `/articles/hello`, ArticlePage appears inside ArticleLayout and RootLayout.
Do not retain the earlier `.page("/articles/:slug", ArticlePage)` registration on the parent.
ArticleLoading appears inside ArticleLayout while the article content suspends.
Its `render` returns a synchronous ReactNode, not an Effect, and an immediate response may not show it visibly.

Child `layout` and `loading` are optional.
Mounted groups must contain a Page and use a fixed prefix.
Put dynamic parameters in the child's `.page()` patterns.
When splitting definitions across modules, export and reuse one `EFFRONT`.
Definitions from separate `Application.effront()` calls cannot be combined.

Use ordinary links for navigation.
To change the default crossfade, see [PageViewTransition configuration](/en/advanced/client-navigation#transition-scope).
