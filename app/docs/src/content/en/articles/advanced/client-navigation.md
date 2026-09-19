A menu's open state and a search field's value can stay in place as users move between pages.
With Effront, you can keep those controls in a shared Layout, navigate with ordinary links, and animate the Page content separately.
Start with that structure, then choose the animation and loading behavior your interface needs.

## Keep shared controls outside the Page {#native-navigation}

Put controls whose state should survive navigation in a Layout shared by the relevant routes.
Keep the content that changes between those routes in their Pages.
A link to a destination is a regular anchor:

```tsx
<a href="/settings">Open settings</a>
```

During client navigation, Effront updates the Page while retaining the shared Layout.
A search input in that Layout can therefore keep its value as the user follows the link.
Do not give the persistent component a `key` that changes with the URL or recreate it inside each Page, because remounting it resets its state.

This behavior requires a browser with both `window.navigation` and `NavigationPrecommitController`.
In other browsers, the same link loads a new document, so in-memory client state does not persist across pages.
Client Components and Server Functions remain available when JavaScript is enabled.
Without JavaScript, users can still follow server-rendered links and use native form submission.

Effront leaves hash-only moves, downloads, form submissions, and reloads to the browser rather than treating them as client page transitions.
It also leaves navigation alone when the browser does not allow interception.
See [MDN's Navigation API documentation](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API) for the underlying browser API.

## Choose an animation for the changing content {#transition-scope}

With shared controls in a Layout, the default animation already has the right scope: in supported browsers, the Page crossfades while shared Layouts remain outside the animation.
No configuration is required for that default.
The operating system's reduced-motion preference suppresses Page animations, including when the preference changes while a page is open, without losing input values or focus.

Choose an override only where the default does not fit:

- To disable a single Page's animation, set `viewTransition: false` in `Page.make`.
- To disable Page animations application-wide, provide `Layer.succeed(PageViewTransition, { enabled: false })` through the `layer` option of `EFFRONT.make`.
- To opt a Page back in after that application-wide opt-out, give it `viewTransition: { enabled: true }`.

Each Page retains its own settings, so moving from an animated Page to a disabled one can still show the outgoing Page's exit animation.
Changing `enabled` on an already mounted Page can reset state inside it, unlike changing the operating system's reduced-motion preference.

For a custom effect, use `PageViewTransition` to associate a transition type with a CSS class.
For example, a photo sequence can use `photo-next` to select `photo-fade` while keeping ordinary navigation on the default animation.
Pass the `transitions` Layer below through `EFFRONT.make({ routes, layer: transitions })`, merging it with any other application Layers you need.
The separate `QuietPage` example shows the per-page opt-out.

```tsx
import { Effect, Layer } from "effect";
import { PageViewTransition } from "@effront/core";

// Pass this configuration through the layer option of EFFRONT.make
const transitions = Layer.succeed(PageViewTransition, {
  default: {
    default: "auto",
    "hmr-refresh": "none",
    "navigation-ua-visual-transition": "none",
    "photo-next": "photo-fade",
  },
});

// Disable transitions for this Page only
const QuietPage = EFFRONT.Page.make({
  viewTransition: false,
  render: () => Effect.succeed(<h1>Quiet page</h1>),
});
```

Provide the `photo-fade` View Transition pseudo-element styles in your application's CSS.
The mapping selects a class, not a built-in photo animation.
Type-to-class maps are replaced rather than merged, which is why the example repeats the default `none` mappings for HMR and browser-provided visual transitions.
A Page's `viewTransition` configuration overrides application settings property by property, with the same map-replacement rule.

Select the custom type on a link with `data-effront-transition-types`:

```tsx
<a href="/photos/2" data-effront-transition-types="photo-next">
  Next photo
</a>
```

The link attribute adds the type for push or replace navigation only.
It does not replay that type when the user later goes back or forward.
Use your own type names rather than the reserved `navigation`, `navigation-*`, `server-function`, and `hmr-refresh` names.

This animation covers the Page change, not every later update within it.
If content revealed by Suspense needs its own animation, add a React ViewTransition boundary around that content.
See [React's ViewTransition reference](https://react.dev/reference/react/ViewTransition) for transition classes, types, and styling.

## Plan for content that arrives after navigation {#commit-and-stream}

A destination can appear with Suspense fallbacks before all its content has loaded.
Give those fallbacks useful loading UI, and place a React Error Boundary around content that can fail as the remaining stream arrives.
The first view of a page is not a guarantee that every part of its response has finished successfully.

Until the destination can be displayed, the current page stays visible.
For an ordinary cancelable navigation, the URL and history are committed when the destination first appears, and the browser proceeds with its standard focus and scroll handling.
Some back and forward navigations are noncancelable, so their URL can change before the screen does.

If the user chooses another destination before the pending one appears, Effront discards the pending destination and ends its request.
The page that is still visible can continue receiving content until its stream finishes or a new page replaces it.
Once a page has appeared, the browser's Stop action does not cancel that page's remaining stream, so provide an error UI rather than relying on navigation cancellation to handle later failures.

## Account for back, forward, and full-page loads {#history-cache}

Back and forward navigation can reuse content whose previous load completed for that exact history entry.
This is not a shared cache for every visit to the same URL: pushing or replacing an entry fetches the destination again.
A history entry without saved content also requires a new fetch.
Design the page to work whether the user returns to saved content or waits for it to load again.

Scroll restoration and focus remain browser behavior.
When Suspense adds content after the initial display, the browser may restore a position recorded while the fallback was visible.
Effront does not wait for all streamed content and then restore the position again.

Ordinary same-origin redirects can continue as client navigation.
Cross-origin redirects, redirects that change the URL during history traversal, and other cases that cannot continue as client navigation load a document instead.
A non-success HTTP response or a response outside the Flight format used for page updates also falls back to document navigation.
Those full-document loads do not retain the shared Layout's in-memory client state, so do not use Layout persistence as durable storage for data the user must keep.
