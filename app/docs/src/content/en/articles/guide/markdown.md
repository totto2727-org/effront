Publish Markdown content as pages in your Effront application.
Article links and local assets resolve to their public URLs.
The example renders an article with `@effront/markdown` and its configured Comark-based React renderer.

## Add an article {#setup}

Install the collection/parser and React renderer in your application:

```bash
vp add @effront/markdown
```

Create `src/content/intro.md`:

```markdown
# Introduction

Welcome to the manual.
```

This collection works with Markdown files loaded at build time.

For Markdown from external sources at runtime, implement your own endpoint and renderer with [Comark](https://comark.dev/) or [TanStack Markdown](https://tanstack.com/markdown/latest).

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
> The collection omits the file extension (`.md`).
> It does not give `index.md` special treatment.
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
Use the same `base` for documents and assets so relative references match.

## Render the article at its URL {#render}

In `src/entry.effront.tsx` from [Getting started](./getting-started.md#application), add the imports.
Define `IntroPage`.
Then register it alongside the homepage:

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
Effront does not supply Markdown body styles.
Style the body in your application or use a library such as Tailwind Typography.
Refer to [Styling](./styling.md).

When `src/content/details.md` has a Page registered at `/manual/details`, `[Details](./details.md#example)` in `intro.md` resolves to `/manual/details#example`.
Relative asset references resolve from the article's directory to their imported URLs.
Missing references fail with `MarkdownError`.

For a catch-all route, use the [complete collection example](https://github.com/totto2727-org/effront/blob/main/examples/markdown/src/entry.effront.tsx).
Find the requested article in HTTP middleware.
If `get()` returns `undefined`, return 404 before rendering starts.
The fixed-route example instead treats a missing registered article as a configuration error.
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
Effront registers Math and Mermaid by default.
Individual registration is not necessary.

To customize them, wrap the exported `Math` from `@effront/markdown/math` or `Mermaid` from `@effront/markdown/mermaid` with your options.
Alternatively, implement your own components.
Pass your replacements through `MarkdownDocument`'s `components`.
Refer to [Comark's React renderer](https://comark.dev/rendering/react) for component options.

> [!WARNING]
> Math and Mermaid need client-side JavaScript.
> They do not render on the server.
> The server skips rendering equations and diagrams and emits only placeholders.
> For SSR, implement replacements that can render on the server.
> Then supply them through `components`.

Refer to the [Markdown reference](../api-reference/markdown.md) for options and reference-resolution rules.
