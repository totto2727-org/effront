Use Effront's Tailwind integration to style your components and share a theme across the application.
It loads the stylesheet for you, whether you use Tailwind's default utilities or a stylesheet with custom theme values and plugins.

## Add Tailwind utilities {#setup}

Install the integration:

```bash
vp add -D @effront/tailwind@0.1.4 @tailwindcss/vite@4.3.3 tailwindcss@4.3.3
```

In `vite.config.ts` from [Getting started](./getting-started.md), add `effrontTailwind()`:

```typescript
// vite.config.ts
import { effrontServer } from "@effront/server/vite";
// Added: Tailwind integration.
import { effrontTailwind } from "@effront/tailwind";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  // Added: effrontTailwind().
  plugins: [effront(), effrontServer(), await effrontTailwind()],
  server: { host: "127.0.0.1", port: 1340, strictPort: true },
});
```

> [!IMPORTANT]
> Remove a separate `@tailwindcss/vite` plugin if present, because `effrontTailwind()` includes it.

No stylesheet or component-level CSS import is needed.

Use utilities in your component's JSX:

```tsx
<h1 className="p-4 text-xl font-bold">Hello</h1>
```

The heading has padding and larger, bold text.

## Define a theme in a stylesheet {#stylesheet}

To add a shared color or other theme value, create `src/styles.css`:

```css
@import "tailwindcss";

@theme {
  --color-brand: #2563eb;
}
```

In `vite.config.ts`, pass the stylesheet to `effrontTailwind()`:

```typescript
// vite.config.ts: replace effrontTailwind() in the plugins array.
await effrontTailwind({ stylesheet: "./src/styles.css" });
```

The path is relative to the Vite root.
This file replaces the default stylesheet, so retain `@import "tailwindcss";`.
Effront loads it automatically without a component-level import.
Use `text-brand` or `bg-brand` to apply the new color.

## Add an optional Tailwind plugin {#scope}

Install a plugin and configure it in the selected stylesheet according to its documentation.
For example, Typography adds styles for article content:

```bash
vp add -D @tailwindcss/typography
```

Add the Typography plugin to `src/styles.css`, keeping the existing import and theme:

```css
/* src/styles.css: add the plugin after the existing import. */
@import "tailwindcss";
/* Added: Typography plugin. */
@plugin "@tailwindcss/typography";
/* Keep the existing @theme block below. */
```

Wrap the article in `<article className="prose">` to style its headings, paragraphs, and lists.
Typography is optional and is not required to render Markdown.

See the [Tailwind API](../api-reference/tailwind.md) for integration options and [Tailwind CSS documentation](https://tailwindcss.com/docs/installation/using-vite) for utilities and theme syntax.
