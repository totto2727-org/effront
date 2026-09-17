# @effront/tailwind

An optional Effront integration that generates and automatically loads Tailwind CSS, including initial server-rendered HTML, without requiring a stylesheet file or manual CSS imports.

## Usage

Style the [Alchemy example's navigation and content](../../examples/alchemy/src/components/shell.tsx) with Tailwind utilities through its [Vite configuration](../../examples/alchemy/vite.config.ts).
With `effrontTailwind()`, `className="max-w-3xl"` renders a 768px maximum content width, and `px-4 py-2` renders 16px horizontal and 8px vertical padding.
These styles apply before hydration, including when JavaScript is disabled.

## Key features

- Includes the official `@tailwindcss/vite` plugin and Tailwind CSS 4.
- Generates a virtual stylesheet without creating `style.css` on disk.
- Automatically loads either the generated stylesheet or an explicitly selected CSS file.
- Supports Tailwind class updates and custom stylesheet HMR.
- Works with native Alchemy hosting and the standalone Cloudflare adapter.

## Prerequisites

- **Integration**: An Effront application using its Vite RSC integration and rendered React client boundaries.
- **CSS plugins**: Install any plugin referenced by a custom stylesheet, such as `@tailwindcss/typography`.
- **Toolchain**: VitePlus or another npm-compatible package manager.

## Setup

After version `0.1.2` is published, install the integration:

```bash
vp add -D @effront/tailwind@0.1.2
```

Import its integration in the Vite configuration:

```ts
import { effrontTailwind } from "@effront/tailwind";
```

## API

### `effrontTailwind(options?: EffrontTailwindOptions)`

Returns Vite plugins that compile Tailwind and automatically load a shared stylesheet through rendered React client boundaries.
Register it once alongside the application's Effront integration; do not also register `@tailwindcss/vite`.

```ts
export default defineConfig({
  plugins: [effrontTailwind(), effront(), effrontAlchemy()],
});
```

The default virtual stylesheet imports Tailwind, which scans the Vite application root for utility classes.
No stylesheet file or component CSS import is needed.
This integration does not inject styles into unrelated HTML pages without rendered client boundaries.

### `EffrontTailwindOptions.stylesheet`

An optional CSS path, resolved relative to the Vite root, replaces the generated stylesheet.
An empty path is rejected.
The selected stylesheet is loaded automatically; do not import it manually.

```ts
effrontTailwind({ stylesheet: "./src/styles.css" });
```

Keep Tailwind's import in the selected file, followed by custom theme or plugin configuration:

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

The [Markdown stylesheet](../../examples/markdown/src/styles.css) demonstrates Typography configuration, while the [documentation stylesheet](../../app/docs/src/styles.css) adds theme definitions.
Tailwind syntax and supported directives are documented in the [official Vite integration guide](https://tailwindcss.com/docs/installation/using-vite).

## Development

See [AGENTS.md](AGENTS.md).

## License

[MIT License](LICENSE).

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
