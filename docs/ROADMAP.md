# Effront roadmap

| Area                                                                         | Status                                                                                 |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [HTML and Flight static generation](#static-site-generation-html-and-flight) | Planned, with no SSG or static-host guarantee                                          |
| [Markdown collections](#markdown-rendering-and-content-collections)          | Initial collections and SSR implemented; typed metadata and extensible loaders planned |
| [Page View Transitions](#page-view-transitions)                              | Implemented                                                                            |
| [Server runtime adapters](#server-runtime-adapters)                          | Node and Bun implemented; AWS and Vercel deferred                                      |

Planned designs below are not public APIs or compatibility guarantees.

## Static site generation: HTML and Flight

Status: planned on 2026-09-12, not implemented.

### Goal

- Generate both the initial document HTML and a separately fetchable React Server Components payload for every statically generated route.
- Reuse Effront's native Flight format, hydration, client navigation, shared Layout retention, history handling, and ViewTransition behavior rather than introducing a second client rendering protocol.
- Initial document requests receive HTML with the hydration data they need; subsequent client navigations and current-route refreshes can fetch only the Flight payload.
- Aim for the same client rendering and navigation semantics as SSR for equivalent content. Static snapshots do not provide request-time freshness, personalized responses, or Server Function execution by themselves.

### Saved route-enumeration prototype

The earlier Markdown route-enumeration implementation is preserved only on branch `backup/markdown-from-pages`, commit `e08074f`, in the fork.
It is a historical SSR prototype, not an SSG implementation or a current public API.
When designing SSG, consult that branch for file-to-route enumeration and initialization validation; design HTML/Flight generation and static parameters against the requirements below rather than restoring its API automatically.
Current Markdown SSR uses request-time collection lookup through catch-all routing.

### Serving without a Worker

- The current SSR client requests Flight at the document URL with `Accept: text/x-component` (`packages/core/src/client/flight-client.ts`).
- Serving HTML and Flight at the same URL requires host-side content negotiation or header-aware routing. Do not assume that a plain static-file host can select different files from this header; `Vary: Accept` describes cache variation, not a rule for selecting the response file.
- Prefer investigating distinct static payload URLs plus a generated route-to-payload manifest. For example, `/guide/routes` serves HTML and an internal versioned asset URL serves its Flight payload; these paths are illustrative, not a committed public convention.
- The client loader would resolve the payload asset while retaining the canonical document URL for history, links, hashes, and redirect semantics. The current loader uses `response.url`, so merely changing the fetch URL would incorrectly treat the asset URL as a navigation destination.
- Distinct resource paths allow an asset-only serving model without requiring a Worker to inspect request headers. Verify the chosen static host's MIME headers, document-path resolution, and cache rules before declaring support.
- Preserve `text/x-component` for Flight and avoid SPA fallback rules that return HTML for a missing payload. Define a safe document-navigation fallback for missing or incompatible artifacts without redirect loops.
- Keep header-negotiated delivery as an optional host capability, not a prerequisite for the baseline SSG output.

### Build and data boundaries

- Enumerate static routes and parameter values explicitly. Define handling of query-dependent variants and unknown paths rather than assuming every request maps to the same snapshot.
- Provide build-time Effect services and complete/dispose each prerender's resources. Reject or explicitly defer routes requiring request-specific credentials, cookies, or runtime bindings.
- Produce HTML, Flight, client chunks, and the route manifest from one build; version their references and define atomic deployment/cache invalidation so clients do not mix incompatible React module references.
- Static refresh reads the published snapshot. Data changes require a new published build or a separately configured dynamic host; Server Functions still need a server endpoint.
- Allow later SSR/SSG hybrid routing as a separate integration decision without making dynamic hosting necessary for purely static routes.

### Acceptance before release

- Serve real generated output through an asset-only host with no Worker or application server and verify direct document loads, no-JavaScript HTML, hydration, and Flight-only subsequent navigation.
- Compare the same routes rendered by SSR and SSG for content, shared Layout state, ViewTransitions, Back/Forward, anchors, and current-route refresh. Equivalent behavior does not imply identical network timing or request-time data freshness.
- Verify payload MIME types, parameter/query policy, redirects, unknown routes, missing payloads, cache isolation, and deployment-version mismatch handling.
- Confirm that secrets and request-specific data cannot enter public static artifacts and that generation handles streaming failures and resource cleanup.

## Markdown rendering and content collections

Status: initial glob-based collections and SSR rendering implemented in `@effront/markdown` on 2026-09-12; typed metadata and extensible loaders remain planned.

The initial package maps a source directory to a public prefix, preserves nested paths, resolves file-relative links and images, and uses standard comark React rendering with the mdts plugin defaults.
See [the package API and example](../packages/markdown/README.md).

### Standard rendering and deferred rich SSR

The 2026-09-15 simplification keeps Vite responsible for raw document imports, asset URLs, bundling, and development updates.
The package prepares collections and parsed documents through typed Effect operations and resolves source-file references to application page URLs or Vite-provided asset URLs.
The configured `@effront/markdown/document` renderer now supplies Math/Mermaid client leaves while preserving the standard Comark document renderer and user component mappings.
Its separate stylesheet supplies scoped prose styles and packaged KaTeX fonts without requiring Tailwind.
The Mermaid leaf removes the upstream global style/font-import fragment and isolates diagram IDs as an explicit presentation policy for trusted content.
Ordinary Markdown remains server-renderable, but Math starts as `...` and Mermaid as an empty container until hydration effects run.
Full no-JavaScript math and diagram rendering remains a future task, rather than a current compatibility guarantee.
Before adding rich SSR support, verify real RSC, Workers HTML/Flight, hydration, and no-JavaScript browser paths, including user mapping precedence and client dependency/network behavior.
Keep Comark's standard parser defaults and treat content, plugins, and embedded components as trusted authored inputs, not sanitized user submissions.

### Direction

- Use comark for Markdown rendering, taking the main monorepo's `js/app/mdts` and `js/app/mdts-example` as local references for content authoring and plugin configuration.
- The current mdts integration exports HTML rendering and plugins through `@comark/html` in `src/comark.ts`. For Effront, prefer comark's standard React integration rather than reproducing that HTML adapter or writing a custom Markdown-to-React renderer.
- Verify the chosen React integration's Server Component, SSR, streaming, and Workers compatibility before selecting its public API. Keep parsing and server-only rendering dependencies out of the client graph.
- Start with a straightforward Markdown-to-React content path usable inside existing Effront Pages and shared Layouts. Preserve JSX authoring and allow application-owned React component mappings where the integration supports them.
- Reuse the existing Shiki and Typography presentation policy where appropriate; determine how comark plugins compose with it instead of adding a second highlighting pipeline by default.

### Target: typed content collections

- Aim for an Astro Content Collections-like authoring experience: named collections, content loaders, schema-validated metadata, stable entry IDs, typed lookup/query APIs, and a separate rendering step.
- Define metadata validation, useful file/entry diagnostics, duplicate-ID handling, and relationships between entries before stabilizing the API.
- Separate content loading and indexing from route creation so an application can choose URLs, parameters, Layouts, and rendering policy.
- Integrate local content discovery, changes, additions, and removals with Vite development and the production build. Preprocess or bundle local files as needed so Workers SSR does not depend on a runtime filesystem.
- Begin with SSR as the rendering target. Content collections do not require SSG; the separate HTML/Flight SSG milestone can later consume the same entries and route enumeration.
- Keep future runtime-specific loaders outside the portable core and extend the collection contract in `@effront/markdown`.

### Acceptance before release

- Render representative real content through the public integration on Vite development and a standalone built Wrangler host, including no-JavaScript HTML, Flight navigation, custom React components, and the existing shared Layout behavior.
- Verify metadata types and validation errors, stable IDs and lookup, development updates, production packaging, and the absence of server-only parsing/highlighting code in client bundles.
- Define and test the trust boundary for raw HTML, links, and embedded components; distinguish trusted repository-authored content from externally supplied Markdown.
- Check the selected comark integration and plugin versions through actual React/RSC execution before documenting supported features.

References: [Astro Content Collections](https://docs.astro.build/en/guides/content-collections/), [comark](https://comark.dev/), and the local main-monorepo mdts implementation noted above.

## Page View Transitions

Status: implemented, following the 2026-09-12 proposal to enable page transitions by default.

- Core wraps each routed Page in a React ViewTransition client boundary; shared Layouts remain outside it.
- `PageViewTransition` from `@effront/core` is a defaulted Effect reference configurable with `Layer.succeed(PageViewTransition, config)`.
- `Page.make({ viewTransition: config, render })` overrides supplied properties; `viewTransition: false` disables that Page's boundary.
- Built-in defaults, application Layer settings, and page settings are resolved in that order, with transition-class maps replaced as whole properties.
- `enabled: true` can re-enable a page under a disabled application default.
- Only serializable class settings cross Flight; application callbacks remain in application-owned React boundaries.
- Existing navigation types and `data-effront-transition-types` are reused without changing native navigation commit or stream lifetimes.
- Reduced motion suppresses framework page animations while preserving the page subtree. The default class map uses `auto`, with `hmr-refresh` and `navigation-ua-visual-transition` mapped to `none`; applications can override that map.
- The outgoing and incoming pages retain their own policy; disabling the destination does not retroactively disable an enabled outgoing page's exit animation.

See the consumer documentation at `/advanced/client-navigation#transition-scope` and `/api-reference/components#view-transition`.
See [ViewTransition validation](../packages/core/docs/VIEW-TRANSITIONS.md) for the observed acceptance results and limits.

References: [React ViewTransition](https://react.dev/reference/react/ViewTransition), [React addTransitionType](https://react.dev/reference/react/addTransitionType).

## Server runtime adapters

Status: native Node and Bun HTTP hosting, static assets, and the separate Vite host integration are implemented in [`@effront/server`](../packages/server/README.md).

- Keep `src/entry.effront.tsx` as the application definition export. Node/Bun applications export a native Effect HTTP `handler` from `src/entry.rsc.ts` and start the host from the separate `src/entry.server.ts`.
- Production uses Effect's standard `HttpServer.serve` with `NodeHttpServer` or `BunHttpServer`, not the Workers Fetch wrapper or workerd.
- Register `effront()` and `effrontServer()` separately. The portable compiler retains distinct browser, RSC, and SSR graphs; only RSC resolves `react-server`.
- Vite development uses `NodeHttpServer.makeHandler` on Vite's existing middleware interface and reloads the RSC entry through its environment runner. Running Vite under Node does not establish Bun-specific development runtime behavior.
- Acquire host services once per server lifetime, while core application Layers remain request-scoped. The native HTTP host owns streaming, cancellation, and request finalization.
- Keep the Workers Fetch implementation and its independent acceptance suites. The new server package does not restore the removed upstream Bun/Rspack runtime.
- The Bun example requires Bun `>=1.4.2`, and the server acceptance package pins Bun `1.4.2` locally rather than changing the global runtime.
- Successful builds and HTTP 200 responses do not establish browser hydration, Server Function, navigation, or end-to-end HMR correctness. Check those workflows, assets, and resource lifetimes through each real host before claiming their guarantees.

Performance improvements from avoiding Fetch conversion or reusing host services remain unmeasured hypotheses, not documented throughput or allocation guarantees.
AWS and Vercel hosting remain deferred.
