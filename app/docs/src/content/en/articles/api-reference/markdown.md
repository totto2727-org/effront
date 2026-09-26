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

`collection.get("/manual/start")` retrieves the article at that site path.
A missing entry returns `undefined`.
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

You can use the preconfigured `MarkdownDocument` from `@effront/markdown/document` and `@effront/markdown/styles.css`.

```tsx
import { MarkdownDocument } from "@effront/markdown/document";
import "@effront/markdown/styles.css";

<MarkdownDocument value={document} />;
```

To customize:

```tsx
import { Mermaid } from "@effront/markdown/mermaid";
import type { ComponentProps } from "react";

function MyMermaid(props: ComponentProps<typeof Mermaid>) {
  return <Mermaid {...props} width="100%" />;
}

<MarkdownDocument value={document} components={{ Mermaid: MyMermaid }} />;
```

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

Relative paths resolve from each Markdown file.

`MarkdownError` has `_tag: "MarkdownError"`, a diagnostic `message`, and optional `cause`.
It covers collection configuration, unresolved references, and parser failures.
