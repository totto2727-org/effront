# Markdown collection and rendering guide

Render Markdown files as React pages with working relative links and images.
Keep collection imports and parsing in the server graph.

## Vite collections

### Load documents and assets

Create `manual.ts` beside your `content/` directory:

```ts
import { createMarkdownCollection } from "@effront/markdown";

export const manual = createMarkdownCollection({
  basePath: "/manual",
  documents: import.meta.glob<string>("./**/*.md", {
    base: "./content",
    query: "?raw",
    import: "default",
    eager: true,
  }),
  assets: import.meta.glob<string>("./**/*.{svg,png,jpg,jpeg,gif,webp,pdf}", {
    base: "./content",
    query: "?url",
    import: "default",
    eager: true,
  }),
});
```

Use the same `base` for both globs so document and asset paths resolve from the same directory.
For example, `content/guide.md` becomes `/manual/guide`, and `![Logo](./logo.svg)` in that document uses Vite's imported URL for `content/logo.svg`.
When each asset should have a separately fetchable URL, change the asset glob in `manual.ts` to use `?url&no-inline`:

```ts
// In manual.ts, change only the assets glob's query; keep documents unchanged.
assets: import.meta.glob<string>("./**/*.{svg,png,jpg,jpeg,gif,webp,pdf}", {
  base: "./content",
  query: "?url&no-inline", // Replace "?url" to prevent asset inlining.
  import: "default",
  eager: true,
}),
```

### Select a page

Evaluate the collection Effect, then look up the public pathname:

```ts
import { Effect } from "effect";
import { manual } from "./manual";

const collection = await Effect.runPromise(manual);
const entry = collection.get("/manual/guide");
console.log(entry?.source); // ./guide.md, if that file exists
```

Pass a pathname, not an absolute URL.
For a Web `Request`, use `new URL(request.url).pathname`; Effect HTTP's server request already supplies a relative `request.url`.
A missing entry returns `undefined` rather than failing the Effect.
Choose the HTTP 404 response before streaming the page, as in the [complete Effront example](../../../examples/markdown/src/entry.effront.tsx).

### Parse and render the entry

Inside your Page's Effect, parse the selected entry in the server graph, then render it with the browser-safe public document component:

```tsx
import { parseMarkdown, type MarkdownEntry } from "@effront/markdown";
import { MarkdownDocument } from "@effront/markdown/document";
import { Effect } from "effect";

export const renderArticle = Effect.fn("renderArticle")(function* (entry: MarkdownEntry) {
  const document = yield* parseMarkdown(entry);
  return <MarkdownDocument value={document} />;
});
```

Import the required KaTeX stylesheet once from an application stylesheet:

```css
@import "@effront/markdown/styles.css";
```

`MarkdownDocument` adds the `effront-markdown` class; the stylesheet supplies KaTeX styling and locally emitted KaTeX fonts.
Define typography, code, table, footnote, alert, responsive layout, and light/dark colors in your application, using plain CSS or your preferred styling library.
The shared renderer does not impose a prose theme or require Tailwind.
Pass `className` to append classes and `components` to override any Comark component mapping, including the built-in `Math` and `Mermaid` mappings.
Comark's Mermaid component observes `html.dark` for diagram theme selection; application prose colors remain independent.
The parser's existing Tokyo Night diagram theme defaults remain unchanged.

Math and Mermaid are client leaves rather than making the prose document a Client Component.
On the server and without JavaScript, Math displays `...` and Mermaid is an empty `.mermaid` container.
After hydration Math renders KaTeX and Mermaid renders its SVG, so these are not SSR diagram or math renderers.
The client wrappers reuse Comark's Math and Mermaid components rather than implementing their renderers or rewriting generated SVG.
Theme options and invalid-input behavior follow the installed Comark version.
The upstream Mermaid renderer includes SVG styles and Google Fonts imports; these are not isolated by this wrapper and can affect other inline SVGs or request remote fonts.
Applications requiring a different style, network, or invalid-input policy can override the component mapping.

> [!WARNING]
> Treat Markdown and parser plugins as trusted content, not sanitized user submissions.

## Public API

### `createMarkdownCollection(options)`

Returns `Effect<MarkdownCollection, MarkdownError>`.

- `basePath`: absolute public prefix such as `/manual` or `/`.
- `documents`: eager raw-string glob map of `.md` files, with `./`-prefixed keys relative to the glob base.
- `assets`: optional eager Vite URL-string glob map of linked files and images, relative to the same glob base.

The resulting collection exposes sorted `entries` and synchronous `get(pathname)` lookup.
Each page URL removes only the `.md` extension from its base-relative filename.
With `basePath: "/manual"`, `guide.md` becomes `/manual/guide`, `index.md` becomes `/manual/index`, and `guide/index.md` becomes `/manual/guide/index`.
To serve `/manual`, use `content/manual.md` with `basePath: "/"`.
Each filename segment is percent-encoded independently of route patterns, and lookup decodes URL escapes once without turning encoded slashes into directory separators.
A single trailing slash is accepted for page lookup.

### Reference resolution

`entry.resolveLink(href)` and `entry.resolveImage(src)` return `Effect<string, MarkdownError>`.
The collection also exposes `resolveLink(entry, href)` and `resolveImage(entry, src)` with the same result type.

Inside `content/guide/start.md`, `[Details](./deep/details.md#example)` becomes `/manual/guide/deep/details#example`.
An image such as `![Diagram](../images/diagram.svg)` resolves from the Markdown file's directory and uses its imported Vite URL.
File paths use POSIX semantics independently of the host operating system or working directory.
The server runtime must support `node:path` and `node:url`.
For Cloudflare Workers, enable the `nodejs_compat` compatibility flag in your Wrangler configuration.
Queries and fragments are retained.
Site-absolute, fragment-only, and external references pass through unchanged; the application remains responsible for URL policy.
Reference queries and fragments are appended literally to the imported asset URL, without merging existing URL queries or fragments.
When an imported URL already contains a query or fragment, use a reference without a conflicting suffix or provide the final URL directly.
Relative `.md` links must identify an imported document, and relative asset references must identify an imported asset.
Unresolved references, references outside the collection, invalid configuration, and duplicate public routes return `MarkdownError` through the Effect error channel.
The source Markdown remains unchanged.

### `parseMarkdown(entry, options?)`

Returns `Effect<MarkdownDocument, MarkdownError>`, where `MarkdownDocument` is Comark's standard parsed-document type.
`options` accepts standard Comark `ParserOptions`; additional `plugins` are appended after the package's mdts plugins.
Parser exceptions become `MarkdownError`, preserving their original `cause`.
After parsing and plugin execution, literal `a.href` and `img.src` attributes contain resolved URLs.
Application-specific components and dynamic attribute bindings retain their normal Comark behavior.

Comark's default configuration remains enabled, including frontmatter, HTML, alerts, task lists, components, and attributes.
The mdts defaults add `footnotes()`, `math()`, `mermaid({ theme: "tokyo-night", themeDark: "tokyo-night" })`, and `shiki()`.

### Rendering and component mappings

Use `MarkdownDocument` and its `MarkdownDocumentProps` type from `@effront/markdown/document` for the configured renderer, separately from the server-only collection/parser entry point.
It forwards Comark's document props, adds the default Math/Mermaid mappings, and preserves user mappings through `components`, for example `<MarkdownDocument value={document} components={{ ProseA: MyLink }} />`.
Resolved AST URLs reach those components without forced link/image mappings.
The prose renderer can stay in the RSC graph while only the Math/Mermaid leaves hydrate in the browser.
`MarkdownDocument` has no `use client` directive; replacing both rich mappings with server-renderable components removes those client leaves from the rendered document.
Importing `@comark/react/components/MarkdownDocument` directly remains supported; that renderer does not automatically register Math or Mermaid or merge `document.meta.components`.
Complete Math and Mermaid SSR support is deferred in the [roadmap](../../../docs/ROADMAP.md).

### Public collection types

`MarkdownCollectionOptions` describes `basePath`, `documents`, and optional `assets` as shown above.
`MarkdownCollection` exposes sorted `entries`, `get(pathname)`, and the two collection-level reference resolvers.
`MarkdownEntry` exposes `source`, `content`, `url`, `pathname`, `resolveLink`, and `resolveImage`.
`source` is the original `./`-prefixed glob key, and `content` is the Markdown source text.
The `url` and `pathname` fields both contain the public absolute pathname.

```ts
import type { MarkdownCollection, MarkdownEntry } from "@effront/markdown";

const selectArticle = (
  collection: MarkdownCollection,
  pathname: string,
): MarkdownEntry | undefined => collection.get(pathname);
```

### `MarkdownError`

The exported tagged error has `_tag: "MarkdownError"`, a diagnostic `message`, and an optional original `cause`.
Collection validation, reference resolution, and parsing return this error through Effect rather than throwing an untyped application error.
Handle it at your application boundary; a missing `get` result is a separate lookup miss.

```ts
import { MarkdownError, createMarkdownCollection } from "@effront/markdown";
import { Effect } from "effect";

const invalid = createMarkdownCollection({ basePath: "manual", documents: {} });
const failure = await Effect.runPromise(Effect.flip(invalid));
console.log(failure instanceof MarkdownError); // true
console.log(failure.message); // basePath must be an absolute pathname without query, fragment, or traversal
```

## References

- [Comark React rendering](https://comark.dev/rendering/react)
- [Vite glob imports](https://vite.dev/guide/features.html#glob-import)
- [Effect NodePath](https://effect.website/docs/v4/api/platform-node-shared/NodePath)
- [Effect expected errors](https://effect.website/docs/error-management/expected-errors/)
