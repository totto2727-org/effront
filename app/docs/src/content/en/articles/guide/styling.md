Tailwind CSS lets you style an Effront application directly in your components with utility classes.
Add the Effront integration to an existing app to start with Tailwind's defaults, without creating a stylesheet.
You can introduce a stylesheet later to define shared design values or configure a Tailwind plugin.

## Use Tailwind classes {#setup}

Install the integration in your application:

```bash
vp add -D @effront/tailwind@0.1.4
```

In your Vite configuration, import `effrontTailwind` and add `effrontTailwind()` to the existing `plugins` array.
Keep `effront()` and your host adapter in that array.
If it already contains `@tailwindcss/vite`, replace that plugin with `effrontTailwind()`, which includes the Tailwind Vite integration.

```typescript
import { effrontTailwind } from "@effront/tailwind";

// Keep your existing effront() and host adapter.
// plugins: [effrontTailwind(), effront(), hostAdapter()]
```

Now style a component through its `className`: `p-4` adds padding, and `text-xl` increases the text size.
No CSS file or component-level CSS import is needed for this setup.
Continue using the standard classes for as long as they meet your design needs.

## Define shared theme values {#stylesheet}

When components should share an application-specific color or font, define it once in a theme stylesheet.
For a custom stylesheet, install Tailwind:

```bash
vp add -D tailwindcss@4.3.3
```

For example, create `src/styles.css` with a brand color:

```css
@import "tailwindcss";

@theme {
  --color-brand: #2563eb;
}
```

Select this file with the `stylesheet` option on your existing `effrontTailwind()` call:

```typescript
effrontTailwind({ stylesheet: "./src/styles.css" });
```

The path is relative to the Vite root.
Your file takes the place of the default stylesheet, so keep the `@import "tailwindcss";` line to include Tailwind's styles.
Effront loads the selected file automatically.
You do not need to add a CSS import to your components.

The brand color is now available as `text-brand` for text and `bg-brand` for backgrounds.
Use these classes in `className` just as you use Tailwind's standard classes.

## Extend styling with a plugin {#scope}

A Tailwind plugin is an optional way to add styles beyond the standard utilities and your theme.
Install the plugin you want, then follow its documentation to configure it in the file selected by `stylesheet`, using `@plugin` where required.
If you are still using the default setup, first create and select a stylesheet as shown above.
You can use a plugin without adding custom theme values.

For example, consider Typography when you want a consistent style for an article's headings, paragraphs, lists, and links.
To use this plugin, install it:

```bash
vp add -D @tailwindcss/typography
```

Then enable it in the selected stylesheet:

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

If that file already contains a theme, retain it and add the `@plugin` line.
Apply `prose` to the element wrapping your article to style the text content inside it.
Typography is only an example, not a prerequisite for styling an Effront app or rendering Markdown.

For the integration's options, see the [Tailwind API](../api-reference/tailwind.md).
For utility classes, theme syntax, and further customization, use the [official Tailwind CSS documentation](https://tailwindcss.com/docs/installation/using-vite).
