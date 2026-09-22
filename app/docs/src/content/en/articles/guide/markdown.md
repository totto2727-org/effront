Publish Markdown content as pages in your Effront application, with article links and local assets resolved to their public URLs.
The example renders an article with `@effront/markdown` and Comark's React renderer.

Continue after changing the heading to `Hello, Effront` in [Getting started](./getting-started.md), with the sample running at [http://127.0.0.1:1340](http://127.0.0.1:1340).

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

> [!NOTE]
> This collection works with Markdown files loaded at build time.
> To display Markdown received from external sources at runtime, implement your own endpoint and rendering with [Comark](https://comark.dev/) or [TanStack Markdown](https://tanstack.com/markdown/latest).

Keep collection imports and parsing in server-side modules.

> [!IMPORTANT]
> On Cloudflare Workers, enable `nodejs_compat` in the host configuration.

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

> [!NOTE]
> The file extension (`.md`) is omitted, and `index.md` is not treated specially.
> With `content/` as the content root and `basePath: "/"`, the mappings are:
>
> - `content/manual.md` → `/manual`
> - `content/manual/index.md` → `/manual/index`

If articles use local images or downloads, update `src/manual.ts` to define and pass `assets`:

```typescript
// src/manual.ts: add before manual.
const assets = import.meta.glob<string>("./**/*.{svg,png,jpg,pdf}", {
  base: "./content",
  query: "?url",
  import: "default",
  eager: true,
});

// Replace the manual declaration, adding assets.
export const manual = createMarkdownCollection({
  basePath: "/manual",
  assets,
  documents: import.meta.glob<string>("./**/*.md", {
    base: "./content",
    query: "?raw",
    import: "default",
    eager: true,
  }),
});
```

Include every referenced asset's file type in the glob.

## Render the article at its URL {#render}

In `src/entry.effront.tsx` from [Getting started](./getting-started.md#application), add the imports, define `IntroPage`, and register it alongside the homepage:

```tsx
// src/entry.effront.tsx: add to the imports.
import { MarkdownDocument } from "@comark/react/components/MarkdownDocument";
import { parseMarkdown } from "@effront/markdown";
import { manual } from "./manual";

// Add before the default export.
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

// Replace the default export.
export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout })
    .page("/", HomePage)
    .page("/manual/intro", IntroPage),
});
```

Open [http://127.0.0.1:1340/manual/intro](http://127.0.0.1:1340/manual/intro) to see the article inside your Layout.
Use [Styling](./styling.md) to add spacing and colors.

When `src/content/details.md` has a Page registered at `/manual/details`, `[Details](./details.md#example)` in `intro.md` resolves to `/manual/details#example`.
Relative asset references resolve from the article's directory to their imported URLs.
Missing references fail with `MarkdownError`.

For a catch-all route, follow the [complete collection example](https://github.com/totto2727-org/effront/blob/main/examples/markdown/src/entry.effront.tsx).
Look up the requested article in HTTP middleware and return 404 before rendering starts when `get()` returns `undefined`.
The fixed-route example above instead treats a missing registered article as a configuration error.
Collection and parsing failures also use the `MarkdownError` Effect error channel.

## Customize parsing or rendering {#authoring}

Use [Comark syntax](https://comark.dev) with `parseMarkdown(entry)` and [Effront's defaults](../api-reference/markdown.md#parse).
To change parsing, pass Comark `ParserOptions` as the second argument, for example `parseMarkdown(entry, { linkify: false })`.

To add a parser plugin, install `comark@0.6.2` as a direct dependency and update `src/entry.effront.tsx`:

```tsx
// src/entry.effront.tsx: add to the imports.
import toc from "comark/plugins/toc";

// Replace IntroPage, keeping its route registration unchanged.
const IntroPage = EFFRONT.Page.make({
  render: Effect.fn("IntroPage.render")(function* () {
    const collection = yield* manual;
    const entry = collection.get("/manual/intro");
    if (!entry) throw new TypeError("Registered article is missing");
    // Add the parser plugin to this call.
    const document = yield* parseMarkdown(entry, { plugins: [toc()] });
    return (
      <article>
        <MarkdownDocument value={document} />
      </article>
    );
  }),
});
```

Additional plugins run after Effront's defaults, not instead of them.
For component mappings, use [Comark's React renderer](https://comark.dev/rendering/react).

> [!NOTE]
> Parser support alone does not make Math or Mermaid render in React: Comark 0.6.2 does not automatically register those components.

See the [Markdown reference](../api-reference/markdown.md) for options and reference-resolution rules.
