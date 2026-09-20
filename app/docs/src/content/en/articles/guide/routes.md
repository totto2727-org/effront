Routing maps URLs to the pages your application displays.
In Effront, you register a Page for each URL pattern, validate any values captured from the path, and group related pages when they need shared UI.

## Make a page reachable {#pages}

A Page supplies the content, while a root Layout supplies the surrounding HTML document.
Create both from the same `EFFRONT` value, register the Page with `.page()`, and export the application definition:

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

Visit `/` to see “Home” inside the document returned by RootLayout.
The `children` property determines where the selected Page appears.
Keep the root Layout when adding routes: the top-level Routes passed to `EFFRONT.make` must have one.

To extend the application, chain additional `.page()` or `.mount()` calls and pass the resulting definition to `EFFRONT.make`.
These methods return new definitions rather than modifying an existing Routes value.
The remaining examples replace the `routes` declaration above and keep the same default export.

## Choose URL patterns and accepted input {#matching}

Choose a pattern according to how much of the URL the page needs to read:

| Pattern           | Use it for               | Captured value                  |
| ----------------- | ------------------------ | ------------------------------- |
| `/`               | A fixed home page        | None                            |
| `/articles/:slug` | One article identifier   | `slug`, such as `hello`         |
| `/manual/*path`   | A path of variable depth | `path`, such as `setup/install` |

For either parameterized pattern, the Page declares a Schema whose named keys match the route parameters.
The Schema receives URL-decoded strings and supplies its validated or transformed result to `render`.
Add `Schema` to the import from `effect`, define the two Pages before `routes`, and replace `routes` as shown:

```tsx
const ArticlePage = EFFRONT.Page.make({
  params: Schema.Struct({ slug: Schema.NonEmptyString }),
  render: ({ params }) =>
    Effect.succeed(
      <article>
        <h1>{params.slug}</h1>
      </article>,
    ),
});

const ManualPage = EFFRONT.Page.make({
  params: Schema.Struct({ path: Schema.String }),
  render: ({ params }) => Effect.succeed(<article>{params.path}</article>),
});

const routes = EFFRONT.Routes.make({ layout: RootLayout })
  .page("/", HomePage)
  .page("/articles/:slug", ArticlePage)
  .page("/manual/*path", ManualPage);
```

Now `/articles/hello` displays “hello”, and `/manual/setup/install` displays “setup/install”.
A terminal `*path` is a catch-all: it captures everything remaining in the path, including an empty string at `/manual` or `/manual/`.
The manual uses `Schema.String` so those two entry URLs are accepted.
Handle the empty string in ManualPage if you want to show a manual introduction there.
A catch-all must be the last part of the pattern and owns its entry URL, so `/manual` cannot also be registered as a separate Page.

**Validate the values your page accepts**

Use the Page's Schema to reject values that do not make sense for the page or to transform strings into the types your rendering code needs.
See the [Effect Schema documentation](https://effect.website/docs/schema/introduction/) for those definitions.
On GET and HEAD, Effront decodes the parameters through the Schema once before rendering.
If decoding fails, the response is 404 and the Page's `render` callback is not called.
This also applies to Flight requests during navigation, where rejection returns an empty 404 response.
A Schema that needs a service can use one provided by the route's Middleware.

Server Function refreshes have a different failure path: if decoding fails while rendering after a POST, the completed operation's result is preserved and the page fails through React's rendering error handling.
Do not treat that rendering failure as evidence that the operation did not run.

**Avoid conflicting registrations**

Parameter names do not make otherwise identical route patterns distinct: `/articles/:slug` conflicts with `/articles/:id`.
More specific routes can coexist with a catch-all: `/manual/about` and `/manual/:section` take precedence over `/manual/*path`.
Leave the `/_effront` namespace to the framework, including patterns that could match it.
An unregistered URL returns 404.

## Group pages under shared UI {#mount}

Once several pages belong to the same section, use a child Routes group to give them a common layout and loading UI.
For the article section, move the `/:slug` registration into a group and mount it at `/articles`.
Add the following definitions before `routes`, then replace `routes` as shown:

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

Visiting `/articles/hello` still selects ArticlePage, now inside ArticleLayout and then RootLayout.
The home and manual pages remain outside ArticleLayout.
Keep only the mounted registration for the article route, not an additional `.page("/articles/:slug", ArticlePage)` on the parent.

ArticleLoading is the Suspense fallback for the article content and appears inside ArticleLayout when that content suspends.
The immediate response in this example may finish without visibly showing the fallback.
Loading returns a synchronous ReactNode, unlike the Effect returned by Page and Layout.

Omit the child group's `layout` or `loading` when you do not need that customization.
Mount a nonempty group under a fixed prefix such as `/articles`.
Declare dynamic parameters in the child group's `.page()` patterns instead.
If you move groups and pages into separate modules, export one shared `EFFRONT` value and import it where definitions are created.
Values created by separate calls to `Application.effront()` cannot be combined in the same application.

With the routes in place, follow ordinary links to move between pages.
Navigation uses a crossfade by default.
[PageViewTransition configuration](/en/advanced/client-navigation#transition-scope) lets you customize or disable it.
