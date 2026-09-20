## Add an article {#setup}

Install the collection/parser and React renderer in your application:

```bash
vp add @effront/markdown@0.1.4 @comark/react@0.6.2
```

Create `src/content/intro.md`:

```markdown
# Introduction

Welcome to the manual.
```

Keep Markdown under trusted authorship.
The parser accepts HTML and components and is not a sanitizer for user submissions.
Keep collection imports and parsing in server-side modules.
On Cloudflare Workers, enable `nodejs_compat` in the host configuration.

## Load the collection {#collection}

Create `src/manual.ts`:

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
});
```

This maps `intro.md` to `/manual/intro` for lookup, but does not register an application route.
Only the `.md` extension is removed: `index.md` maps to `/manual/index`, not `/manual`.

If articles use local images or downloads, define `assets` before `manual` and add it as the collection's `assets` option:

```typescript
const assets = import.meta.glob<string>("./**/*.{svg,png,jpg,pdf}", {
  base: "./content",
  query: "?url",
  import: "default",
  eager: true,
});
```

Include every referenced asset's file type in the glob.

## Render the article at its URL {#render}

In the application entry from [Getting started](./getting-started.md#application), keep `EFFRONT`, RootLayout, HomePage, and the `Effect` import.
Add these imports and Page:

```tsx
import { MarkdownDocument } from "@comark/react/components/MarkdownDocument";
import { parseMarkdown } from "@effront/markdown";
import { manual } from "./manual";

const IntroPage = EFFRONT.Page.make({
  render: Effect.fn("IntroPage.render")(function* () {
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

Replace the default export to register the article alongside the homepage:

```tsx
export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout })
    .page("/", HomePage)
    .page("/manual/intro", IntroPage),
});
```

Open `/manual/intro` to see the article inside your Layout.
Use [Styling](./styling.md) to add spacing and colors.

For a second article, add `src/content/details.md` and register its Page at `/manual/details`.
`[Details](./details.md#example)` in `intro.md` then resolves to `/manual/details#example`.
Relative asset references resolve from the article's directory to their imported URLs.
Missing references fail with `MarkdownError`.

For a catch-all route, follow the [complete collection example](https://github.com/totto2727-org/effront/blob/main/examples/markdown/src/entry.effront.tsx).
Look up the requested article in HTTP middleware and return 404 before rendering starts when `get()` returns `undefined`.
The fixed-route example above instead treats a missing registered article as a configuration error.
Collection and parsing failures also use the `MarkdownError` Effect error channel.

## Customize parsing or rendering {#authoring}

Use [Comark syntax](https://comark.dev) with `parseMarkdown(entry)` and [Effront's defaults](../api-reference/markdown.md#parse).
To change parsing, pass Comark `ParserOptions` as the second argument, for example `parseMarkdown(entry, { linkify: false })`.

To add a parser plugin, install `comark@0.6.2` as a direct dependency and import the plugin:

```typescript
import toc from "comark/plugins/toc";

const document = yield * parseMarkdown(entry, { plugins: [toc()] });
```

Place this parsing call inside the Page's generator in place of the earlier call.
Additional plugins run after Effront's defaults, not instead of them.
For component mappings, use [Comark's React renderer](https://comark.dev/rendering/react).
Parser support alone does not make Math or Mermaid render in React: Comark 0.6.2 does not automatically register those components.
See the [Markdown reference](../api-reference/markdown.md) for options and reference-resolution rules.
