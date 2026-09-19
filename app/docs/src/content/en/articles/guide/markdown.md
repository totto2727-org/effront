Use Markdown when you want to edit article content separately from your application's page components.
With `@effront/markdown`, a Page can render a file from your project and resolve its links to other articles and assets.
You choose which URLs serve those articles and which layouts surround them.

Start by publishing one article at `/manual/intro`.
Once it is visible, you can add linked articles or change how Markdown is parsed without replacing the Page's rendering code.

## Prepare your first article {#setup}

This guide assumes you already have an Effront application, including the `EFFRONT` and RootLayout values shown in [Getting started](./getting-started.md#application).
Add the collection/parser package and the React component that will display its output:

```bash
vp add @effront/markdown@0.1.4 @comark/react@0.6.2
```

Create `src/content/intro.md` and write the article you want to publish.
For Markdown syntax, use the [Comark documentation](https://comark.dev).
Keep this content under trusted authorship: the parser is not a sanitizer for untrusted submissions.

The collection and parser belong in server-side modules, not Client Components.
On Cloudflare Workers, enable `nodejs_compat` in your host configuration.

## Make the article available to your Page {#collection}

Create `src/manual.ts` beside the `content` directory.
The following collection associates your Markdown files with a `/manual` URL prefix and makes imported assets available to their relative links:

```typescript
import { createMarkdownCollection } from "@effront/markdown";

export const manual = createMarkdownCollection({
  basePath: "/manual",
  documents: import.meta.glob<string>("./**/*.md", {
    base: "./content",
    query: "?raw",
    import: "default",
    eager: true,
  }),
  assets: import.meta.glob<string>("./**/*.{svg,png,jpg,pdf}", {
    base: "./content",
    query: "?url",
    import: "default",
    eager: true,
  }),
});
```

`documents` imports the text of each article, while `assets` imports the URLs of images and downloadable files.
Use the same `base` for both globs so references resolve from a shared content directory.
You can omit `assets` if your articles do not refer to local assets.

The collection now identifies `intro.md` as `/manual/intro`.
This makes the article available for lookup, but you still need to connect it to an application route.

## Publish the article and connect related pages {#render}

In `src/entry.effront.tsx`, keep `EFFRONT`, `RootLayout`, `HomePage`, and the `Effect` import from Getting started.
Add these imports and define `IntroPage` before the default export.
The Page selects the article, parses it inside its Effect, and passes the result to Comark's `MarkdownDocument`:

```tsx
import { MarkdownDocument } from "@comark/react/components/MarkdownDocument";
import { parseMarkdown } from "@effront/markdown";
import { manual } from "./manual";

const IntroPage = EFFRONT.Page.make({
  render: () =>
    Effect.gen(function* () {
      const collection = yield* manual;
      const entry = collection.get("/manual/intro");
      if (!entry) throw new TypeError("Registered article is missing");
      const document = yield* parseMarkdown(entry);
      return (
        <article>
          <MarkdownDocument value={document} />
        </article>
      );
    }),
});
```

Replace the existing default export with the following registration.
This keeps the homepage and adds the article route:

```tsx
export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout })
    .page("/", HomePage)
    .page("/manual/intro", IntroPage),
});
```

Open `/manual/intro` to check that the article text appears inside your layout.
For visual changes such as spacing and colors, continue with [Styling](./styling.md).

To connect a second article, add `src/content/details.md` and register a Page for `/manual/details` in the same way.
A link written as `[Details](./details.md#example)` in `intro.md` will point to `/manual/details#example`.
Relative image and file references likewise use the assets imported by the collection, so include each referenced file in the appropriate glob.

When choosing routes, remember that the collection removes only `.md` from filenames: `index.md` maps to `/manual/index`, not `/manual`.
To use another URL, explicitly map your application route to the corresponding document.

For a larger collection, you can replace per-article route registration with a catch-all route, as shown in the [complete collection example](https://github.com/totto2727-org/effront/blob/main/examples/markdown/src/entry.effront.tsx).
In that case, look up the requested article in HTTP middleware and return a 404 before rendering or streaming starts if it is missing.
`get()` returns `undefined` for a missing article, whereas collection, parsing, and reference-resolution failures use the Effect error channel with `MarkdownError`.
The fixed-route example above treats a missing `intro.md` as a configuration error rather than a visitor's unknown URL.

## Keep the defaults or customize parsing {#authoring}

No parser configuration is needed for the Page above: `parseMarkdown(entry)` uses [Effront's defaults](../api-reference/markdown.md#parse).
Use these first, then pass Comark's `ParserOptions` as the second argument when you want to change a setting.
For example, disable automatic URL linking with:

```typescript
const document = yield * parseMarkdown(entry, { linkify: false });
```

For additional parsing features, supply plugins through the same options object.
The following example adds Comark's table-of-contents plugin:

```typescript
import toc from "comark/plugins/toc";

const document = yield * parseMarkdown(entry, { plugins: [toc()] });
```

Add `comark@0.6.2` as an application dependency when importing its plugins directly.
Your plugins are appended after Effront's defaults, not used to remove or replace them.

Parser options control how the document is produced, while component mappings control how it is displayed.
Use [Comark's React renderer documentation](https://comark.dev/rendering/react) for custom rendering components and the [Markdown reference](../api-reference/markdown.md) for Effront's API and reference-resolution constraints.
