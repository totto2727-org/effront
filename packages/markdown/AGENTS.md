# @effront/markdown development

## Repository structure

- `src/collection.ts` owns glob-map indexing, URL lookup, and source-relative references.
- `src/parse.ts` owns Comark parsing, default mdts plugins, and post-parse link/image resolution.
- `src/error.ts` owns the shared `MarkdownError` failure type.
- `src/document.tsx` owns the configured renderer, `src/math.tsx` and `src/mermaid.tsx` wrap upstream client components, and `src/styles.css` supplies required KaTeX styles.
- `docs/GUIDE.md` owns the consumer API; `docs/IMPLEMENTATION.md` preserves the collection flowcharts and verification boundaries.

## Architecture

- Keep Vite responsible for file discovery, raw text, and asset emission. The collection accepts already-loaded maps, not a filesystem loader or copy step.
- Preserve segment-wise URL encoding and single decoding. Use Effect's `NodePath.layerPosix` for host-independent source-relative paths, with `node:path` and `node:url` available in the runtime.
- Keep configuration, reference, and parsing failures typed as `MarkdownError`. Missing page lookup stays an ordinary `undefined` result so the application can choose a 404 before streaming.
- Resolve literal `a.href` and `img.src` attributes after standard Comark parsing and user plugins. Preserve dynamic bindings and application component mappings.
- Keep the collection/parser entry point independent from the public document renderer and preserve Comark's document format and user component mappings.
- Keep ordinary prose server-renderable and restrict client boundaries to rich leaves. Do not evaluate Mermaid's rendering dependency during SSR or claim completed no-JavaScript math/diagrams.
- Reuse Comark's default Math/Mermaid components through minimal client wrappers. Do not add custom rendering, SVG/font rewriting, theme filtering, or parser AST rewrites for presentation.
- Keep shared CSS minimal. Applications own prose, typography, layout, alerts, and colors; preserve upstream rendering defaults rather than imposing a shared theme.
- Preserve local CSS/font resolution and the KaTeX license in the published archive. Verify the actual built browser host and public asset paths after changing renderer or pack settings.
- Retain KaTeX while Comark's math parser imports it, independently of whether a consumer renders math components.

## Task-specific documentation

- When changing collections, parsing, or API behavior, review the colocated tests and [implementation flowcharts](docs/IMPLEMENTATION.md), using the [shared development commands](../../AGENTS.md#development-commands).
- When changing Markdown rendering and assets, use [built-artifact acceptance](../../docs/TESTING.md).
- When changing document edits, additions, and deletion, use [development HMR acceptance](../../docs/TESTING.md).
- When considering typed metadata, loaders, or rich SSR support, consult the [roadmap](../../docs/ROADMAP.md).

_This AGENTS.md was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [AGENTS template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/agents/template.md)._
