## effrontTailwind {#plugin}

`effrontTailwind(options?: EffrontTailwindOptions): Promise<PluginOption[]>` from `@effront/tailwind` loads the application's declared `@tailwindcss/vite` and `tailwindcss` packages, then adds one stylesheet.
Register it once alongside the application's Effront plugin and host adapter:

```typescript
import { effront } from "@effront/vite";
import { effrontCloudflare } from "@effront/cloudflare";
import { effrontTailwind } from "@effront/tailwind";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontCloudflare(), await effrontTailwind({ root: import.meta.dirname })],
});
```

Do not register `@tailwindcss/vite` separately.
With both packages declared and installed, the plugin generates Tailwind's default stylesheet. Without them, ordinary CSS compiles without Tailwind; declaring just one produces a warning, and declaring them without installing them fails configuration. `root` defaults to the current working directory; set it to `import.meta.dirname` to keep imported Vite configurations tied to the application package.
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

Install both packages in the application with `vp add -D @tailwindcss/vite@4.3.3 tailwindcss@4.3.3`.
The selected file replaces the generated entry and needs no additional component import.
It can contain [`@theme`](https://tailwindcss.com/docs/theme) and [`@plugin`](https://tailwindcss.com/docs/functions-and-directives) directives.
Plugins such as Typography must be installed separately and are optional, including for Markdown rendering.
