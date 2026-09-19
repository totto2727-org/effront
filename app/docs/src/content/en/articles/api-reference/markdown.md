`@effront/markdown` connects page requests to Vite-loaded Markdown while allowing authors to keep links relative to their source files.
Use this reference to select a document, configure its parser, or check how a link becomes a public URL.
For an end-to-end page implementation, follow the [Markdown guide](../guide/markdown.md).

## createMarkdownCollection: document lookup {#collection}

Call `createMarkdownCollection(options)` to prepare the documents your application can serve.
It returns `Effect<MarkdownCollection, MarkdownError>`.
Evaluate that Effect to obtain the collection used for subsequent lookups.
The exported `MarkdownCollectionOptions` type describes these inputs:

| Option      | What to supply                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `basePath`  | An absolute public path prefix, such as `/manual` or `/`, without a query, fragment, or `..` traversal                         |
| `documents` | An eager Vite `?raw` glob map of `.md` files, with Markdown string values and `./`-prefixed keys relative to the glob's `base` |
| `assets`    | An optional eager Vite `?url` glob map for linked files and images, relative to the same `base`                                |

Keep collection creation and parsing on the server.
For Cloudflare Workers, enable `nodejs_compat` in the Wrangler configuration.
Configuration errors, including duplicate public paths, produce a `MarkdownError` when the collection Effect runs.

To find the requested document, call `collection.get(pathname)` with an absolute pathname such as `/manual/start`.
This is a synchronous lookup: it returns a `MarkdownEntry`, or `undefined` when the path has no matching document.
Handle that missing result in your route, for example by returning a 404, before passing an entry to `parseMarkdown`.
Use `collection.entries` when you need all entries, sorted by public URL, rather than one requested page.

Each entry carries its Markdown text in `content` and its original glob key in `source`.
Its `url` and `pathname` both contain the same public absolute pathname.
The exported `MarkdownEntry` and `MarkdownCollection` types describe these results, including the [reference resolvers](#references).

**File names and public paths**

A document's public path removes only `.md` and URL-encodes each path segment.
For `basePath: "/manual"`, `./start.md` maps to `/manual/start`, while `./index.md` maps to `/manual/index`, not `/manual`.
Lookup decodes URL escapes once, accepts one trailing slash, and ignores the query and fragment.

## parseMarkdown: parsing and rendering {#parse}

Pass the selected entry to `parseMarkdown(entry, options?)`.
The result is `Effect<MarkdownDocument, MarkdownError>`, where `MarkdownDocument` is Comark's parsed-document type.
Pass that document as the `value` prop of `MarkdownDocument` imported from `@comark/react/components/MarkdownDocument` to render it.
This keeps document selection separate from presentation: use the renderer's normal `components` prop, such as `components={{ ProseA: MyLink }}`, when an element needs your application's component.
The [Comark React documentation](https://comark.dev/rendering/react) covers the renderer API.

**What is enabled by default?**

Calling `parseMarkdown(entry)` retains Comark's default configuration and adds the following plugins:

| Plugin                                                        | Added behavior                                              |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| `footnotes()`                                                 | Footnote parsing                                            |
| `math()`                                                      | Math parsing                                                |
| `mermaid({ theme: "tokyo-night", themeDark: "tokyo-night" })` | Mermaid parsing with the same theme in light and dark modes |
| `shiki()`                                                     | Code highlighting                                           |

These parser defaults do not make Math and Mermaid fully renderable in SSR by themselves.
Comark 0.6.2 does not automatically register their React components or merge `document.meta.components` into the renderer's mappings.
If your documents use these features, supply the required components and verify the server-rendered result.

**How can parsing be customized?**

The optional second argument accepts Comark's `ParserOptions`.
Use it to change settings such as `linkify`, or provide a `plugins` array to extend parsing.
The array is appended after the four plugins above, rather than replacing them.
There is no option to remove or replace Effront's added plugins.
`registerDefaultPlugins: false` disables only Comark's own defaults.
For Comark options and syntax beyond this contract, refer to the [official Comark documentation](https://comark.dev).

Only parse trusted authored Markdown and use trusted plugins.
The parser is not a sanitizer for untrusted submissions.
Exceptions raised during parsing become `MarkdownError` values with the original exception retained in `cause`.

## Resolving links and assets {#references}

`parseMarkdown` resolves string values in `a.href` and `img.src` after parsing and plugin execution.
When you need a resolved URL without parsing a document, call `entry.resolveLink(href)` or `entry.resolveImage(src)` directly.
The equivalent collection methods are `collection.resolveLink(entry, href)` and `collection.resolveImage(entry, src)`.
All four return `Effect<string, MarkdownError>` and use the Markdown file's directory as the base for relative paths.

Relative `.md` links must name a file in `documents` and resolve to that entry's public URL.
Relative asset links and images must name a file in `assets` and resolve to its imported Vite URL.
Fragment-only references, paths beginning with `/`, and external URLs pass through unchanged.
Queries and fragments on relative references are preserved.

For example, a link from `./guide/start.md` to `./details.md#example` resolves to `/manual/guide/details#example` when `basePath` is `/manual` and both documents are registered.
For assets, the reference's query and fragment are appended literally to the imported URL, without merging an existing query or fragment.
If that URL already has a suffix, avoid a conflicting suffix in the reference or provide the complete URL directly.

An unresolved relative reference or one escaping the collection's base produces `MarkdownError`, including when resolution happens inside `parseMarkdown`.
Unlike the `undefined` result of `get`, this is a failure in the Effect error channel.
The exported `MarkdownError` has `_tag: "MarkdownError"`, a diagnostic `message`, and an optional original `cause` for application error handling.
