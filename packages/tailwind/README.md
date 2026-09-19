# @effront/tailwind

An optional Effront integration that generates and automatically loads Tailwind CSS, including initial server-rendered HTML, without requiring a stylesheet file or manual CSS imports.

## Usage

Style the [Alchemy example's navigation and content](../../examples/alchemy/src/components/shell.tsx) with Tailwind utilities through its [Vite configuration](../../examples/alchemy/vite.config.ts).
With `effrontTailwind()`, `className="max-w-3xl"` renders a 768px maximum content width, and `px-4 py-2` renders 16px horizontal and 8px vertical padding.
These styles apply before hydration, including when JavaScript is disabled.

## Key features

- Includes the official `@tailwindcss/vite` plugin and Tailwind CSS 4.
- Works without a CSS file or manual CSS imports.
- Automatically loads either the generated stylesheet or an explicitly selected CSS file.
- Supports Tailwind class updates and custom stylesheet HMR.
- Works with native Alchemy hosting and the standalone Cloudflare adapter.

## Prerequisites

- **Integration**: An Effront application using its Vite integration.
- **Toolchain**: VitePlus or another npm-compatible package manager.

## Setup

Install the integration:

```bash
vp add -D @effront/tailwind@0.1.4
```

Import its integration in the Vite configuration:

```ts
import { effrontTailwind } from "@effront/tailwind";
```

## API

### `effrontTailwind(options?: EffrontTailwindOptions)`

Add this plugin to use the default Tailwind CSS configuration.
Register it once alongside the application's Effront integration; do not also register `@tailwindcss/vite`.

```ts
export default defineConfig({
  plugins: [effrontTailwind(), effront(), effrontAlchemy()],
});
```

Use Tailwind classes in your components.
No stylesheet file, extra CSS plugin, or component CSS import is needed for the default configuration.

### `EffrontTailwindOptions.stylesheet`

To customize a theme or other Tailwind settings, create a CSS file and pass its path through `stylesheet`.
The path is resolved relative to the Vite root.
The selected stylesheet is loaded automatically; do not import it manually.

```ts
effrontTailwind({ stylesheet: "./src/styles.css" });
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
For example, `@tailwindcss/typography` uses `@plugin "@tailwindcss/typography";` and provides the `prose` class.
Typography is one optional plugin, not a requirement for Effront or Markdown.
The [Markdown stylesheet](../../examples/markdown/src/styles.css) demonstrates Typography configuration, while the [documentation stylesheet](../../app/docs/src/styles.css) adds theme definitions.
Tailwind syntax and supported directives are documented in the [official Vite integration guide](https://tailwindcss.com/docs/installation/using-vite).

## Development

See [AGENTS.md](AGENTS.md).

## License

[MIT License](LICENSE).

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
