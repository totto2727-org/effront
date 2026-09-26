Use `Layout` for the HTML shared by pages, `Page` for each page's content, and `Routes` to connect them to URLs.
This guide starts with a homepage, then adds path parameters and a section with its own layout and loading UI.

The first three sections explain the parts of `src/entry.effront.tsx`; the [complete entry](#application) puts them together.

## Define the shared Layout {#layouts}

A Layout renders the HTML around a page.
Its `children` value is the page content, or a nested layout when routes are grouped.
The root Layout provides the document's `<html>` and `<body>` elements.

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
```

`Application.effront()` creates the definition used to make the Layout, Pages, and Routes in this file.
The Layout's `render` returns an Effect containing its React elements.

## Define the Page content {#pages}

A Page supplies the content for a URL.
Define `HomePage` after `RootLayout`:

```tsx
const HomePage = EFFRONT.Page.make({
  render: () => Effect.succeed(<h1>Home</h1>),
});
```

Here, `Effect.succeed` wraps content that does not need to load data.
For data-backed pages, `render` can read [application services](./effect.md) before returning its elements.
Defining the Page alone does not give it a URL.

## Connect the Layout and Page with Routes {#routes}

`Routes.make` creates a route group.
Give the root group its Layout, then use `.page(path, page)` to associate a URL path with a Page:

```tsx
const routes = EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage);
```

This registration renders `HomePage` inside `RootLayout` when the browser requests `/`.
The root group needs a Layout and at least one Page.
Calls to `.page()` and `.mount()` return new route definitions, so keep their return values.

## Run the complete application entry {#application}

Replace `src/entry.effront.tsx` with the complete entry below.
The default export gives the configured routes to the application.

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

Save, then open `/` to see `Home` where RootLayout renders `children`.

## Read path parameters {#matching}

In `src/entry.effront.tsx`, add `Schema`, define the two Pages before `routes`, and replace the route registration:

```tsx
// src/entry.effront.tsx: replace the effect import.
import { Effect, Schema } from "effect";

// Add both Pages immediately before routes.
const ArticlePage = EFFRONT.Page.make({
  params: Schema.Struct({ slug: Schema.NonEmptyString }),
  render: ({ params }) => Effect.succeed(<h1>{params.slug}</h1>),
});

const ManualPage = EFFRONT.Page.make({
  params: Schema.Struct({ path: Schema.String }),
  render: ({ params }) => Effect.succeed(<article>{params.path || "Manual"}</article>),
});

// Replace routes.
const routes = EFFRONT.Routes.make({ layout: RootLayout })
  .page("/", HomePage)
  .page("/articles/:slug", ArticlePage)
  .page("/manual/*path", ManualPage);
```

Open these paths:

- `/articles/hello` displays `hello`.
- `/manual/setup/install` displays `setup/install`.
- `/manual` and `/manual/` supply an empty `path` and display `Manual`.

A named parameter captures one segment.
A terminal catch-all captures the remaining path, including an empty string, and must be last in the pattern.
Do not also register `/manual`, because `/manual/*path` already owns that URL.
More specific paths such as `/manual/about` and `/manual/:section` take precedence over the catch-all.
Renaming a parameter does not create a distinct route: `/articles/:slug` conflicts with `/articles/:id`.

> [!WARNING]
> Keep `/_effront` and patterns that could match it reserved.

Schemas receive URL-decoded strings and pass their decoded values to `render`.
Use [Effect Schema](https://effect.website/docs/schema/introduction/) to validate or transform them.
For GET and HEAD, a decoding failure returns 404 before rendering, including during client navigation.
Unregistered URLs also return 404.
For the complete matching and decoding contract, see the [routing API reference](../api-reference/routing.md).

## Add a section layout and loading UI {#mount}

In `src/entry.effront.tsx`, replace ArticlePage, then add the section definitions before `routes` and replace its registration:

```tsx
// Replace ArticlePage to make the loading UI visible.
const ArticlePage = EFFRONT.Page.make({
  params: Schema.Struct({ slug: Schema.NonEmptyString }),
  render: Effect.fn("ArticlePage.render")(function* ({ params }) {
    yield* Effect.sleep("2 seconds");
    return <h1>{params.slug}</h1>;
  }),
});

// Add these definitions immediately before routes.
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

// Replace routes, removing the direct /articles/:slug registration.
const routes = EFFRONT.Routes.make({ layout: RootLayout })
  .page("/", HomePage)
  .page("/manual/*path", ManualPage)
  .mount("/articles", articles);
```

Open `/articles/hello`.
ArticleLayout displays `Articles` with `Loading article…` beneath it, then replaces the loading message with `hello` after the two-second delay.
