Publish Markdown content as pages in your Effront application, with article links and local assets resolved to their public URLs.
The example renders an article with `@effront/markdown` and its configured Comark-based React renderer.

## Add an article {#setup}

Install the collection/parser and React renderer in your application:

```bash
vp add @effront/markdown@0.1.4
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
Use the same `base` for documents and assets so references share one content root.
If each asset needs a separately fetchable URL, change the asset glob's `query` to `"?url&no-inline"` to prevent Vite from inlining it.

## Render the article at its URL {#render}

In `src/entry.effront.tsx` from [Getting started](./getting-started.md#application), add the imports, define `IntroPage`, and register it alongside the homepage:

```tsx
// src/entry.effront.tsx: add to the imports.
import { MarkdownDocument } from "@effront/markdown/document";
import "@effront/markdown/styles.css";
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

Open `/manual/intro` to see the article inside your Layout.
Markdown body styling is not provided.
Style it in your application or use a library such as Tailwind Typography; see [Styling](./styling.md).

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
The `MarkdownDocument` and stylesheet imports above are sufficient to render the parsed document.
Math and Mermaid are registered by default, with no individual registration needed.
Effront supplies Comark-based components and minimal Math/Mermaid CSS.
To customize them, wrap the exported `Math` from `@effront/markdown/math` or `Mermaid` from `@effront/markdown/mermaid` with your desired options, or implement your own components.
Pass your replacements through `MarkdownDocument`'s `components`.
See [Comark's React renderer](https://comark.dev/rendering/react) for component options.

> [!WARNING]
> Math and Mermaid currently require client-side JavaScript and do not support SSR.
> The server skips rendering equations and diagrams and emits only placeholders.
> If you need SSR, implement server-renderable replacements and supply them through `components`.

See the [Markdown reference](../api-reference/markdown.md) for options and reference-resolution rules.
