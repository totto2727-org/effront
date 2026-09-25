# @effront/markdown

Parse Markdown for React rendering and resolve relative links and images to Vite-loaded documents and assets.

## Usage

Resolve a guide's relative link and image before rendering it:

```ts
import { createMarkdownCollection, parseMarkdown } from "@effront/markdown";
import { Effect } from "effect";

const collection = await Effect.runPromise(
  createMarkdownCollection({
    basePath: "/manual",
    documents: {
      "./start.md": "[Guide](./guide.md#intro)\n\n![Logo](./logo.svg)",
      "./guide.md": "# Intro",
    },
    assets: { "./logo.svg": "/assets/logo.hash.svg" },
  }),
);
const entry = collection.get("/manual/start");
if (entry) {
  const document = await Effect.runPromise(parseMarkdown(entry));
  console.log(JSON.stringify(document.nodes));
  // Link href: /manual/guide#intro
  // Image src: /assets/logo.hash.svg
}
```

> [!WARNING]
> Use trusted authored Markdown and parser plugins; this integration does not sanitize untrusted submissions.

See the [collection and React rendering guide](docs/GUIDE.md#vite-collections) to load files with `import.meta.glob` and render them with `MarkdownDocument` from `@effront/markdown/document`.

## Key features

- Maps Markdown filenames to public routes without losing directory structure.
- Resolves document links, image references, queries, and fragments relative to each source file.
- Uses Vite's asset URLs without a runtime filesystem loader or asset-copying step.
- Preserves Comark's standard document format and typed Effect error handling.
- Includes footnotes, math, Mermaid parsing, and Shiki highlighting.
- Registers Comark's default Math/Mermaid components through client wrappers and distributes KaTeX CSS/fonts; application styles remain application-owned.

## Prerequisites

- **Content loading**: A Vite application when using `import.meta.glob` to supply document and asset maps.
- **Server runtime**: Support for `node:path` and `node:url`. Cloudflare Workers requires the `nodejs_compat` compatibility flag.
- **React rendering**: Matching React and React DOM 19.3 installations, including React DOM's `browser` API; Math and Mermaid require browser JavaScript to finish rendering.

## Setup

Install the collection package and Effect in your application:

```bash
npm install @effront/markdown@0.1.4 effect@4.0.0-rc.112
```

For React rendering, import the component and load its stylesheet once in your application:

```tsx
import { MarkdownDocument } from "@effront/markdown/document";
import "@effront/markdown/styles.css";
```

Comark, KaTeX, and the diagram renderer are package dependencies; no separate component registration or KaTeX font setup is required.
Supply your own prose, layout, alert, and color styles.
The wrappers preserve upstream rendering behavior, including Mermaid's embedded SVG styles and remote font imports.

## API

The [public API guide](docs/GUIDE.md#public-api) covers collection options and types, lookups, reference resolution, `parseMarkdown`, `MarkdownError`, and configured document rendering with component overrides.
It also documents URL encoding, missing-reference failures, and current Math and Mermaid rendering constraints.

## Development

See [AGENTS.md](AGENTS.md).

## License

[MIT License](LICENSE).

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
