Client navigation replaces the Page while preserving shared Layouts.
The destination can appear before its response finishes, so a completed navigation is not the same as completed loading.

## What persists between pages {#native-navigation}

Ordinary anchors participate in client navigation:

```tsx
<a href="/settings">Open settings</a>
```

A search input or menu in a Layout shared by both routes can retain its state while the Page changes.
Moving that control into each Page, or giving it a `key` that changes with the URL, remounts it and resets its state.

Client navigation requires both `window.navigation` and `NavigationPrecommitController`.
Without them, links load a new document and in-memory state does not persist between pages.
Client Components and Server Functions still work with JavaScript enabled.
Without JavaScript, server-rendered links and native form submissions remain available.

Hash-only moves, downloads, form submissions, reloads, and navigation the browser does not allow Effront to intercept remain browser-managed.
See [MDN's Navigation API documentation](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API) for the browser API.

## Page transitions and persistent Layouts {#transition-scope}

In supported browsers, the Page crossfades by default while shared Layouts remain outside the animation.
The operating system's reduced-motion preference suppresses Page animations, including when changed while a page is open, without resetting input state or focus.

`Page.make({ viewTransition: false, render })` removes that Page's transition boundary.
Application-wide settings come from `Layer.succeed(PageViewTransition, config)` passed through the `layer` option of `EFFRONT.make`.
With `{ enabled: false }` at application scope, a Page can opt back in with `viewTransition: { enabled: true }`.
See the [transition configuration reference](/en/api-reference/components#view-transition) for imports and available properties.

Each Page retains its own settings, so navigating to a disabled Page can still show the outgoing Page's exit animation.
Changing `enabled` on an already mounted Page can reset its state, unlike a reduced-motion preference change.

Transition types select CSS classes, not built-in custom animations.
For example, this link adds the application's `photo-next` type:

```tsx
<a href="/photos/2" data-effront-transition-types="photo-next">
  Next photo
</a>
```

A `PageViewTransition` class mapping can associate `photo-next` with `photo-fade`.
The application must supply the matching View Transition pseudo-element styles.
Page settings override application settings property by property, but type-to-class maps are replaced, not merged.
A replacement `default` map must include `default: "auto"`, `"hmr-refresh": "none"`, and `"navigation-ua-visual-transition": "none"` to retain those defaults.

The link attribute adds types only for push or replace navigation, not later Back or Forward traversal.
`navigation`, `navigation-*`, `server-function`, and `hmr-refresh` are reserved type names.
The Page animation does not cover every later Suspense reveal.
That content needs its own [React ViewTransition boundary](https://react.dev/reference/react/ViewTransition) if it should animate separately.

## Display, URL, and stream completion {#commit-and-stream}

The current page stays visible until the destination can be displayed.
For cancelable navigation, the URL and history commit when the destination first appears, followed by the browser's standard focus and scroll handling.
Some Back and Forward traversals are noncancelable, so their URL can change before the screen does.

The first display can contain Suspense fallbacks while the rest of the response streams in.
Loading UI therefore needs to remain useful after navigation completes, and content that can fail during streaming needs a React Error Boundary.

Choosing another destination before the pending one appears discards the pending destination and ends its request.
The still-visible page can continue receiving content until its stream finishes or another page replaces it.
Once a destination appears, the browser's Stop action does not cancel its remaining stream.

## History reuse and document loads {#history-cache}

Back and Forward can reuse content whose load completed for that exact history entry.
This is not a URL-wide cache: push, replace, or traversal without saved content fetches the destination again.

Scroll restoration and focus remain browser behavior.
If Suspense adds content after the initial display, the browser may restore a position recorded while the fallback was visible.
Effront does not wait for the remaining content and restore the position again.

Same-origin redirects can continue as client navigation when the browser allows it.
Cross-origin redirects, URL-changing redirects during history traversal, and other redirects that cannot continue as client navigation load a document instead.
Non-success HTTP responses and responses outside the Flight format used for page updates also fall back to document navigation.
Those document loads discard shared Layout state, so Layout persistence is not durable storage for unsaved user data.
