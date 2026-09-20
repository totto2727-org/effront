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

| Collection member                                      | Result                                          |
| ------------------------------------------------------ | ----------------------------------------------- |
| `get(pathname)`                                        | Synchronous `MarkdownEntry \| undefined` lookup |
| `entries`                                              | Readonly entries sorted by public URL           |
| `resolveLink(entry, href)`, `resolveImage(entry, src)` | [Reference resolution Effects](#references)     |

Lookup requires an absolute pathname, decodes URL escapes once, accepts one trailing slash, and ignores queries and fragments.
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

The parsed result is the `value` prop for `MarkdownDocument` from `@comark/react/components/MarkdownDocument`.
Its standard `components` prop supports replacements such as `components={{ ProseA: MyLink }}`.
See the [Comark React API](https://comark.dev/rendering/react).
Comark 0.6.2 does not automatically register Math/Mermaid React components or merge `document.meta.components` into renderer mappings.
Parser support alone therefore does not establish full SSR rendering.
Supply those components and verify the result if needed.

Only trusted authored Markdown and trusted plugins are supported.
This parser is not a sanitizer.
Parser exceptions become `MarkdownError` with the original exception in `cause`.

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
Queries and fragments are preserved: `./details.md#example` from `./guide/start.md` resolves to `/manual/guide/details#example` under `/manual`.
Asset suffixes are appended literally to the imported URL, not merged with an existing query or fragment.
Avoid conflicting suffixes or use the complete URL.

`MarkdownError` has `_tag: "MarkdownError"`, a diagnostic `message`, and optional `cause`.
It covers collection configuration, unresolved references, and parser failures.
