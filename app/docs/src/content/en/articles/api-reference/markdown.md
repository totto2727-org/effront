`@effront/markdown` provides URL-based document collections and Comark parsing for applications that render imported Markdown.
For page integration, see [Markdown](../guide/markdown.md).

## createMarkdownCollection {#collection}

`createMarkdownCollection(options)` returns `Effect.Effect<MarkdownCollection, MarkdownError>`.

| `MarkdownCollectionOptions` field | Contract                                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `basePath`                        | Required absolute public prefix, such as `/manual` or `/`, without query, fragment, or `..` traversal                 |
| `documents`                       | Required `Readonly<Record<string, string>>` of `.md` source keys to Markdown text, normally an eager Vite `?raw` glob |
| `assets`                          | Optional map of source keys to imported asset URLs, normally an eager Vite `?url` glob with the same `base`           |

Source keys must begin with `./`, be relative to the collection base, and contain no `..` segments.
Invalid options and duplicate public paths fail with `MarkdownError` when the Effect runs.
Collection creation and parsing belong on the server.
Cloudflare Workers requires `nodejs_compat` in the Wrangler configuration.
The server runtime must support `node:path` and `node:url`.

| Collection member                                      | Result                                          |
| ------------------------------------------------------ | ----------------------------------------------- |
| `get(pathname)`                                        | Synchronous `MarkdownEntry \| undefined` lookup |
| `entries`                                              | Readonly entries sorted by public URL           |
| `resolveLink(entry, href)`, `resolveImage(entry, src)` | [Reference resolution Effects](#references)     |

Lookup requires an absolute pathname, decodes URL escapes once, accepts one trailing slash, and ignores queries and fragments.
For a Web `Request`, pass `new URL(request.url).pathname`, not the absolute URL.
Encoded slashes remain within their filename segment rather than becoming directory separators.
A missing entry returns `undefined`, not a typed failure.
Handle it before parsing, for example with a 404 response.

| `MarkdownEntry` field                    | Value                              |
| ---------------------------------------- | ---------------------------------- |
| `source`                                 | Original glob key                  |
| `content`                                | Markdown text                      |
| `url`, `pathname`                        | Identical absolute public pathname |
| `resolveLink(href)`, `resolveImage(src)` | Entry-relative resolution Effects  |

Public paths remove only `.md` and URL-encode each segment.
With `basePath: "/manual"`, `./start.md` becomes `/manual/start` and `./index.md` becomes `/manual/index`, not `/manual`.

## parseMarkdown {#parse}

`parseMarkdown(entry, options?)` returns `Effect.Effect<MarkdownDocument, MarkdownError>`, using Comark's document type and `ParserOptions`.
It preserves Comark defaults and adds these plugins:

| Plugin                                                        | Behavior                                           |
| ------------------------------------------------------------- | -------------------------------------------------- |
| `footnotes()`                                                 | Footnotes                                          |
| `math()`                                                      | Math parsing                                       |
| `mermaid({ theme: "tokyo-night", themeDark: "tokyo-night" })` | Mermaid parsing with one theme in both color modes |
| `shiki()`                                                     | Code highlighting                                  |

`options.plugins` is appended after these four plugins, not substituted for them.
No option removes Effront's added plugins.
`registerDefaultPlugins: false` disables only Comark's defaults.
Other options, such as `linkify`, follow [Comark](https://comark.dev).

> [!WARNING]
> Only trusted authored Markdown and trusted plugins are supported.
> This parser is not a sanitizer.

Parser exceptions become `MarkdownError` with the original exception in `cause`.

## Markdown rendering {#rendering}

Import `MarkdownDocument` from `@effront/markdown/document` and `@effront/markdown/styles.css`, then pass the parsed document through `value`.
These imports are sufficient: the Comark-based Math and Mermaid components are registered by default, with no individual registration needed.

To customize rendering, wrap `Math` from `@effront/markdown/math` or `Mermaid` from `@effront/markdown/mermaid` with your desired options, or implement your own components.
Pass the replacements through `MarkdownDocument`'s `components`, for example `components={{ Math: MyMath, Mermaid: MyMermaid }}`.
See the [Comark React API](https://comark.dev/rendering/react) for component options.

> [!WARNING]
> Math and Mermaid currently require client-side JavaScript and do not support SSR.
> The server skips rendering equations and diagrams and emits only placeholders.
> If you need SSR, implement server-renderable replacements and supply them through `components`.

## Links, assets, and MarkdownError {#references}

`entry.resolveLink(href)` and `entry.resolveImage(src)` return `Effect.Effect<string, MarkdownError>`.
The collection exposes equivalent methods that take `entry` first.
`parseMarkdown` calls these resolvers for string `a.href` and `img.src` values after parsing and plugin execution.

| Reference                                                   | Resolution                     |
| ----------------------------------------------------------- | ------------------------------ |
| Relative `.md` link                                         | Imported document's public URL |
| Relative asset link or image                                | Imported asset's Vite URL      |
| Fragment-only, `/`-prefixed, or external URL                | Unchanged                      |
| Missing relative target or path outside the collection base | `MarkdownError`                |

Relative paths use the source document's directory.
Resolution uses POSIX paths independently of the host operating system or working directory.
The Markdown source is unchanged, and dynamic attribute bindings and custom component mappings retain Comark's behavior.
The application remains responsible for the URL policy of references that pass through unchanged.
Queries and fragments are preserved: `./details.md#example` from `./guide/start.md` resolves to `/manual/guide/details#example` under `/manual`.
Asset suffixes are appended literally to the imported URL, not merged with an existing query or fragment.
Avoid conflicting suffixes or use the complete URL.

`MarkdownError` has `_tag: "MarkdownError"`, a diagnostic `message`, and optional `cause`.
It covers collection configuration, unresolved references, and parser failures.
