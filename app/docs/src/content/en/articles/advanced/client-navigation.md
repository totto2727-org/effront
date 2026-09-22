Use ordinary links to switch Pages without replacing shared Layouts.

## Follow ordinary links {#native-navigation}

Use an anchor for a registered page:

```tsx
<a href="/settings">Settings</a>
```

Keep search inputs and other controls in a shared Layout to retain their state between pages.
The Page fades by default in supported browsers, while shared Layouts stay outside the animation.

> [!NOTE]
> Browsers without client navigation support load a new document, which resets Layout state.
> Links also work without JavaScript.
> See [browser support](/en/architecture/implementation/navigation#browser-start).

## Turn off a Page's animation {#transition-scope}

These excerpts use the shared `EFFRONT` factory from `./effront` and [registered root Routes](/en/guide/routes#application) from `./routes`.

Page definition:

```tsx
import { Effect } from "effect";
import { EFFRONT } from "./effront";

export const SettingsPage = EFFRONT.Page.make({
  viewTransition: false,
  render: () => Effect.succeed(<h1>Settings</h1>),
});
```

Register `SettingsPage` with [Routes.page](/en/guide/routes#routes).
Settings has no Page animation when you follow a link to its URL.

> [!NOTE]
> The Page you leave can still animate if its own animation is enabled.
> The operating system's reduced-motion setting suppresses Page animations without resetting input state or focus.

## Turn off animations across the application {#global-config}

Application definition:

```tsx
import { PageViewTransition } from "@effront/core";
import { Layer } from "effect";
import { EFFRONT } from "./effront";
import { routes } from "./routes";

export default EFFRONT.make({
  routes,
  layer: Layer.succeed(PageViewTransition, { enabled: false }),
});
```

Pages now change without Page animations unless a Page explicitly enables them.
To enable the animation only for Settings, replace the Page definition:

```tsx
export const SettingsPage = EFFRONT.Page.make({
  viewTransition: { enabled: true },
  render: () => Effect.succeed(<h1>Settings</h1>),
});
```

In supported browsers, Settings can animate unless reduced motion is enabled.
See the [PageViewTransition reference](/en/api-reference/components#view-transition) for custom animations and other options.

## Keep loading UI visible until content arrives {#commit-and-stream}

The destination can appear before its content finishes loading.
Use [Loading or Suspense](/en/guide/routes#mount) until the content arrives.
For content that can fail during streaming, add a [React Error Boundary](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary).
See [display and stream completion](/en/architecture/implementation/navigation#transition-commit) for URL timing and cancellation behavior.

## Back, Forward, and reload {#history-cache}

Back and Forward can reuse a completed response for that history entry.
Reloads and [document fallbacks](/en/architecture/implementation/navigation#flight-load) load a new document.

> [!NOTE]
> A full document load discards Layout state.
> Save important user input independently of the Layout.
