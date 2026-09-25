# Markdown implementation

## Purpose

This document explains the collection's indexes, resolution algorithm, rendering graphs, and build artifacts for maintainers.
Consumer contracts live in the [API reference](../../../app/docs/src/content/en/articles/api-reference/markdown.md).

## Responsibilities

Vite owns file discovery and asset emission.
The collection consumes loaded maps rather than implementing a runtime filesystem loader, asset copier, or bundler.
Source-relative path operations use Effect's [`NodePath.layerPosix`](https://effect.website/docs/v4/api/platform-node-shared/NodePath) so slash-separated Vite keys have host-independent semantics.
The source index and public URL index remain separate: reference resolution needs source filenames, while request lookup needs encoded public routes.

## collection.ts processing flow

Source: [`packages/markdown/src/collection.ts`](../src/collection.ts).
This file indexes strings and asset URLs loaded by Vite.
Markdown parsing and React rendering are separate operations.

### 1. Create a collection

`createMarkdownCollection(options)` returns an Effect, and the following steps run when that Effect executes.
`documents` is a map of `?raw` strings, and `assets` is a map of `?url` URLs.

```mermaid
flowchart TD
    A["Run Effect: basePath / documents / assets"] --> P["Get the Path service from NodePath.layerPosix"]
    P --> B["Split basePath into segments"]
    B --> C{"Is the configuration valid?"}
    C -->|No| E["Fail the Effect with MarkdownError"]
    C -->|Yes| D["Create public URL, source, and asset indexes"]
    D --> F{"Any remaining assets?"}
    F -->|Yes| G{"Is the glob key relative to the collection base?"}
    G -->|No| E
    G -->|Yes| H["Encode each key segment and register it<br/>Keep the Vite URL unchanged"]
    H --> F
    F -->|No| I{"Any remaining Markdown documents?"}
    I -->|Yes| J{"Is the glob key relative to the collection base<br/>and does its filename end in .md?"}
    J -->|No| E
    J -->|Yes| K["Combine the glob key's relative hierarchy with basePath<br/>Remove only the .md extension"]
    K --> L["Encode each segment to create the public URL"]
    L --> M{"Is the public URL duplicated?"}
    M -->|Yes| E
    M -->|No| N["Create an Entry with content, URL, and reference resolvers<br/>Register it in both public URL and source indexes"]
    N --> I
    I -->|No| O["Return URL-sorted entries / get / resolveLink / resolveImage"]
```

`Entry.source` remains the source-index key used by diagnostics and relative resolution, not a filesystem loading instruction.

### 2. Look up an Entry by request URL

`get(pathname)` synchronously searches the public URL index.

```mermaid
flowchart TD
    A["get: request pathname"] --> B["Remove the first query or fragment and everything after it"]
    B --> C{"Does it start with /?"}
    C -->|No| X["undefined"]
    C -->|Yes| D["Remove a single trailing /<br/>Preserve repeated /"]
    D --> E["Remove the leading / and split into segments"]
    E --> F["Decode each segment once<br/>Keep the original string if decoding fails"]
    F --> G["Re-encode each segment to create the index key"]
    G --> H{"Does the public URL index contain it?"}
    H -->|Yes| Y["MarkdownEntry"]
    H -->|No| X
```

Splitting before decoding prevents encoded slashes within segments from becoming directory boundaries.
Filenames containing the literal string `%20` are looked up without decoding the URL's `%2520` twice.

### 3. Resolve links and image references in Markdown

`resolveLink` and `resolveImage` are Effects that share `resolveLocal`.
The former can resolve Markdown files to page URLs, while the latter uses only the asset index.

```mermaid
flowchart TD
    A["Run the resolveLink / resolveImage Effect"] --> B{"Does the reference start with #, /, or a scheme?"}
    B -->|Yes| C["Return the reference unchanged"]
    B -->|No| D["Separate the path from its query / fragment suffix"]
    D --> E{"Is the path empty?"}
    E -->|Yes| F["Return the current Entry URL + suffix"]
    E -->|No| G["Use Path.dirname on the encoded source path to get the base directory"]
    G --> H["Split the reference, decode each segment once, and re-encode<br/>Keep encoded slashes within segments"]
    H --> I["Join and normalize the relative reference with Path.join"]
    I --> J{"Is the result .. or does it start with ../?"}
    J -->|Yes| X["Fail the Effect with MarkdownError"]
    J -->|No| K["Use Path.resolve to create an index key relative to the fixed / root"]
    K --> L{"Is this a link to a .md target?"}
    L -->|Yes| M["Get the Entry's public URL from the source index"]
    L -->|No| N["Get the Vite URL from the asset index"]
    M --> O{"Was the target found?"}
    N --> O
    O -->|No| X
    O -->|Yes| P["Return the retrieved URL + suffix"]
```

Comark and the application own the policy for external and root-relative URLs.
Vite owns asset loading, transformation, and emission, and this operation only looks up the supplied URLs.
The suffix is appended as a string without reconstructing or merging the existing URL's query.

## Rendering

`parseMarkdown` resolves link/image attributes after the parser plugins, keeping URL resolution independent from rendering.
`@effront/markdown/document` wraps Comark's direct document-rendering entry point with configurable defaults and an `effront-markdown` wrapper class.
It does not import the collection/parser entry point or make the whole article a Client Component.
Only the Math and Mermaid wrappers carry `use client`; they reuse Comark's default components and keep the Mermaid dependency out of the SSR graph.
Mermaid uses [`use(browser())`](https://react.dev/reference/react-dom/browser) inside a `Suspense` boundary to leave its fallback on the server, then [`lazy`](https://react.dev/reference/react/lazy) loads the upstream component in the browser.
React manages loading and retries instead of a wrapper-owned Effect and mounted state.
The document wrapper merges its default component mappings with the caller's mappings using object spread and leaves component resolution to Comark.
The library build copies KaTeX's local fonts and license beside the emitted stylesheet so its relative font URLs survive package publication.
The wrappers do not filter themes, rewrite SVG styles or IDs, or replace upstream invalid-input behavior.

Ordinary prose stays in the server-rendering graph.
Math starts as `...` and Mermaid as an empty container until client effects run; rich no-JavaScript rendering remains deferred in [the roadmap](../../../docs/ROADMAP.md#standard-rendering-and-deferred-rich-ssr).

## Verification

For package checks and unit coverage, use the [package development instructions](../AGENTS.md).
For rendered Markdown and asset behavior, use [built-artifact acceptance](../../../docs/TESTING.md).
For document edits, additions, and deletion, use [development HMR acceptance](../../../docs/TESTING.md).

Typed metadata, relationships, loaders, and richer SSR support remain separate [roadmap items](../../../docs/ROADMAP.md).
