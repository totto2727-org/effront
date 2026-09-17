# @effront/tailwind

Optional Tailwind CSS integration for Effront, distributed separately from `@effront/vite`.
It includes `@tailwindcss/vite` and Tailwind CSS 4.

## Default stylesheet

```ts
import { effrontTailwind } from "@effront/tailwind";
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effrontTailwind(), effrontAlchemy()],
});
```

No CSS file, CSS import in a component, or separate `@tailwindcss/vite` registration is required.
The plugin provides a virtual stylesheet containing Tailwind's standard import; it never writes `style.css` to disk.
Tailwind scans the Vite application root for utility classes.
The same plugin works alongside `effront()` and the standalone Cloudflare adapter.

## Custom stylesheet

```ts
effrontTailwind({ stylesheet: "./src/styles.css" });
```

Paths resolve from the Vite root.
The supplied stylesheet replaces the generated stylesheet and is loaded automatically; do not import it manually.
Keep `@import "tailwindcss";` in this custom stylesheet, followed by any `@theme`, `@plugin`, or other CSS configuration.
Install plugins referenced by `@plugin` in the application, for example `@tailwindcss/typography`.
The Markdown example uses a custom stylesheet for Typography and the docs application retains its theme definitions.

## Loading and rendering

The integration adds a shared CSS import to modules with a leading `"use client"` directive, preserving the directive prologue and original source lines.
Effront's React client boundaries allow the RSC plugin to include the stylesheet in initial server-rendered HTML, not only after hydration.
Repeated imports resolve to the same CSS module, with links deduplicated by the RSC/React CSS pipeline.
Server-only modules and raw asset requests are left unchanged.
Use this plugin with Effront's RSC integration; it does not inject styles into unrelated HTML pages without rendered client boundaries.

Tailwind compilation, source scanning, and CSS updates are handled by the official [Tailwind Vite plugin](https://tailwindcss.com/docs/installation/using-vite).
