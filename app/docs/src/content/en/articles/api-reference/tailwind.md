Add Tailwind CSS 4 to an Effront application with `effrontTailwind()` and start using utility classes in your components.
The default configuration needs no CSS file.
When your application needs its own theme or additional Tailwind plugins, select a stylesheet to hold that configuration.

## Enable Tailwind with effrontTailwind {#plugin}

Import `effrontTailwind` from `@effront/tailwind` in your Vite configuration and add `effrontTailwind()` to its `plugins` array.
Keep the application's existing Effront integration and host adapter.

**Vite configuration excerpt: insert into the existing `plugins` array**

```typescript
plugins: [
  // Keep your existing Effront integration and host adapter here.
  effrontTailwind(),
],
```

This generates and automatically loads Tailwind's default stylesheet, so utilities such as `p-4` and `text-xl` are ready to use in `className`.
You do not need to create a stylesheet or import CSS from a component.
For installation and a complete walkthrough, see [Styling](../guide/styling.md).

**Function contract**

`effrontTailwind(options?: EffrontTailwindOptions)` accepts an optional options object and returns `PluginOption[]` for Vite.
The returned plugins include `@tailwindcss/vite` as well as Effront's stylesheet integration.
Register `effrontTailwind()` once, replacing any separate `@tailwindcss/vite` registration rather than adding both.

## Customize with stylesheet {#stylesheet}

Use `EffrontTailwindOptions.stylesheet` when you want to define a theme or configure a Tailwind plugin.
It selects your CSS file instead of the generated default stylesheet.
Before using a custom stylesheet, install Tailwind in the application so that its `@import "tailwindcss"` can resolve:

```bash
vp add -D tailwindcss@4.3.3
```

For example, this call selects `src/styles.css` relative to the Vite root:

```typescript
effrontTailwind({ stylesheet: "./src/styles.css" });
```

| `stylesheet` value     | Behavior                                                              |
| ---------------------- | --------------------------------------------------------------------- |
| Omitted or `undefined` | Generate and load Tailwind's default stylesheet.                      |
| A non-empty `string`   | Resolve the path from the Vite root and automatically load that file. |
| `""`                   | Throw a `TypeError` when `effrontTailwind` is called.                 |

The selected file is your CSS entry, not an addition to the default entry.
Keep `@import "tailwindcss";` in it to include Tailwind, followed by your custom configuration.
You do not need a component import for this file either.

**Define a theme**

To make a brand color available as a utility, put the following in `src/styles.css`:

```css
@import "tailwindcss";

@theme {
  --color-brand: #2563eb;
}
```

You can now use `text-brand` for text or `bg-brand` for backgrounds.
During development, changes to Tailwind classes and the selected stylesheet are reflected through HMR.
See Tailwind's [theme documentation](https://tailwindcss.com/docs/theme) for other theme settings.

**Add a plugin when you need it**

Tailwind plugins extend the styles available to your application.
Install the plugin you choose and configure it in the selected stylesheet according to its documentation.

For example, Typography provides the `prose` class for styling article content.
Install it with `vp add -D @tailwindcss/typography`, then add its `@plugin` directive to your stylesheet:

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

Keep any existing theme settings, and apply `prose` to the element wrapping your article to style its headings and paragraphs.
Typography is optional, not a prerequisite for Tailwind utilities or Markdown rendering.
See Tailwind's [functions and directives](https://tailwindcss.com/docs/functions-and-directives) for the CSS configuration syntax.
