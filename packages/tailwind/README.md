# @effront/tailwind

Style Effront pages with Tailwind CSS, including the initial HTML, without manual CSS imports.

## Usage

Add `effrontTailwind()` to your application's Vite plugins.
For example, with Alchemy:

```ts
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effrontTailwind } from "@effront/tailwind";
import { effront } from "@effront/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [await effrontTailwind({ root: import.meta.dirname }), effront(), effrontAlchemy()],
});
```

Render this component from a Page or Layout:

```tsx
"use client";

export function Greeting() {
  return <p className="max-w-3xl px-4 py-2">Hello, Tailwind!</p>;
}
```

With Tailwind's default theme, the paragraph has a maximum width of `48rem` and padding of `1rem` horizontally and `0.5rem` vertically.
The styles apply in the initial HTML, including with JavaScript disabled.
See the [Alchemy navigation component](../../examples/basic/src/components/shell.tsx) and [Vite configuration](../../examples/basic/vite.config.ts) for a complete application.

## Key features

- Loads the application's own `@tailwindcss/vite` plugin when both it and `tailwindcss` are declared.
- Loads a generated stylesheet or your selected CSS file without manual imports.
- Supports Tailwind class updates and custom stylesheet HMR.

## Prerequisites

- An Effront application using `@effront/vite` and a host adapter.

## Setup

Install the integration:

```bash
vp add -D @effront/tailwind@0.1.4 @tailwindcss/vite@4.3.3 tailwindcss@4.3.3
```

## API

### `effrontTailwind(options?: EffrontTailwindOptions): Promise<PluginOption[]>`

Await this function in your Vite configuration. It loads the application's own Tailwind Vite plugin when both packages are declared and installed; otherwise ordinary CSS still works without Tailwind. A single declared package produces a warning; declared but missing installations fail configuration.
Register it once; do not also register `@tailwindcss/vite`.
Omitting `stylesheet` generates the default Tailwind stylesheet only when Tailwind is enabled. Set `root` to the application package directory, for example `import.meta.dirname`, so imported Vite configurations work from another working directory.

### `EffrontTailwindOptions.stylesheet`

To customize a theme or other Tailwind settings, create a CSS file and pass its path through `stylesheet`.
The path is resolved relative to the Vite root.
The selected stylesheet is loaded automatically; do not import it manually.
An empty path throws `TypeError`.

In the Usage configuration, replace the no-options call:

```ts
export default defineConfig({
  // Replace effrontTailwind() with the explicit stylesheet selection.
  plugins: [
    await effrontTailwind({ root: import.meta.dirname, stylesheet: "./src/styles.css" }),
    effront(),
    effrontAlchemy(),
  ],
});
```

Keep Tailwind's import in the selected file, followed by custom theme or plugin configuration:

```css
@import "tailwindcss";

@theme {
  --color-brand: #2563eb;
}
```

This example makes `text-brand` and `bg-brand` available.

To add a Tailwind plugin, install the chosen package and configure it in the selected stylesheet according to its documentation.
For example, after installing `@tailwindcss/typography`, add its directive to the stylesheet above to make the `prose` class available:

```css
@import "tailwindcss";
/* Add this directive after the import; keep the existing @theme block. */
@plugin "@tailwindcss/typography";
```

Typography is one optional plugin, not a requirement for Effront or Markdown.
The [Markdown stylesheet](../../examples/markdown/src/styles.css) demonstrates Typography configuration, while the [documentation stylesheet](../../app/docs/src/styles.css) adds theme definitions.
Tailwind syntax and supported directives are documented in the [official Vite integration guide](https://tailwindcss.com/docs/installation/using-vite).

## Development

See [AGENTS.md](AGENTS.md).

## License

[MIT License](LICENSE).

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
