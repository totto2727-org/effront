## effrontTailwind {#plugin}

`effrontTailwind(options?: EffrontTailwindOptions): PluginOption[]` from `@effront/tailwind` includes `@tailwindcss/vite` and automatically loads one Tailwind CSS 4 stylesheet.
Register it once alongside the application's Effront plugin and host adapter:

```typescript
import { effront } from "@effront/vite";
import { effrontCloudflare } from "@effront/cloudflare";
import { effrontTailwind } from "@effront/tailwind";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontCloudflare(), effrontTailwind()],
});
```

Do not register `@tailwindcss/vite` separately.
With no options, the plugin generates Tailwind's default stylesheet.
No CSS file or component-level CSS import is needed.
Class and stylesheet changes use HMR during development.
See [Styling](../guide/styling.md) for installation and application examples.

## stylesheet {#stylesheet}

`EffrontTailwindOptions.stylesheet?: string` selects a CSS entry instead of the generated stylesheet.

| Value                  | Behavior                                                    |
| ---------------------- | ----------------------------------------------------------- |
| Omitted or `undefined` | Generate and load the default stylesheet                    |
| Nonempty string        | Resolve from the Vite root and load that file automatically |
| `""`                   | Throw `TypeError` when `effrontTailwind` is called          |

For `effrontTailwind({ stylesheet: "./src/styles.css" })`, `src/styles.css` must include Tailwind itself:

```css
@import "tailwindcss";
```

That import requires `tailwindcss` in the application's dependencies, for example `vp add -D tailwindcss@4.3.3`.
The selected file replaces the generated entry and needs no additional component import.
It can contain [`@theme`](https://tailwindcss.com/docs/theme) and [`@plugin`](https://tailwindcss.com/docs/functions-and-directives) directives.
Plugins such as Typography must be installed separately and are optional, including for Markdown rendering.
