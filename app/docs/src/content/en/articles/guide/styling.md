## Add Tailwind utilities {#setup}

Install the integration:

```bash
vp add -D @effront/tailwind@0.1.4
```

In your Vite configuration, import and create the styling plugins:

```typescript
import { effrontTailwind } from "@effront/tailwind";

const stylingPlugins = [effrontTailwind()];
```

Add `...stylingPlugins` to the existing `plugins` array, keeping `effront()` and your host plugin.
Remove a separate `@tailwindcss/vite` plugin if present, because `effrontTailwind()` includes it.
No stylesheet or component-level CSS import is needed.

Use utilities in your component's JSX:

```tsx
<h1 className="p-4 text-xl font-bold">Hello</h1>
```

The heading has padding and larger, bold text.

## Define a theme in a stylesheet {#stylesheet}

To add a shared color or other theme value, install Tailwind as a direct dependency:

```bash
vp add -D tailwindcss@4.3.3
```

Create `src/styles.css`:

```css
@import "tailwindcss";

@theme {
  --color-brand: #2563eb;
}
```

Replace the earlier `stylingPlugins` declaration with:

```typescript
const stylingPlugins = [effrontTailwind({ stylesheet: "./src/styles.css" })];
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

Add this line to `src/styles.css`, keeping the existing import and theme:

```css
@plugin "@tailwindcss/typography";
```

Wrap the article in `<article className="prose">` to style its headings, paragraphs, and lists.
Typography is optional and is not required to render Markdown.

See the [Tailwind API](../api-reference/tailwind.md) for integration options and [Tailwind CSS documentation](https://tailwindcss.com/docs/installation/using-vite) for utilities and theme syntax.
