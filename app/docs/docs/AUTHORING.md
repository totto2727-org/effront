# SSR documentation site

Author English articles at `/en` and Japanese translations at `/ja`.
The site renders cache misses through Effront and Alchemy's native Cloudflare integration and serves complete production HTML and Flight responses from a build-scoped edge cache.
Unprefixed Japanese URLs remain available for existing bookmarks.

## Author or change an article

For Markdown articles:

1. Identify the reader's task and verify the public API or implementation it needs.
2. Write the English article in `src/content/en/articles/`, using steps and observable results for a how-to guide or API contracts for reference.
3. Review the English article, then translate it into Japanese under `src/content/articles/`. Keep the examples and API contracts equivalent.
4. Update `src/content/en/catalog.ts` and `src/content/catalog.ts` with the title, description, document path, and exact heading ID/title order. Keep IDs aligned, such as `## Setup {#setup}` and `## セットアップ {#setup}`.
5. Register explicit `/en` and `/ja` routes in `src/entry.effront.tsx`. Preserve existing unprefixed compatibility routes.
6. Run content tests and built-site browser acceptance in both languages, including article links and the language switch.

For Architecture chapters, edit the English JSX in `src/content/en/architecture/` and the Japanese JSX in `src/content/core-model.tsx` or `src/content/core-runtime.tsx`.
Update each chapter's page metadata with its content and follow the [architecture source baseline](#architecture-source-baseline) rules for exact excerpts.

Use fenced code blocks with an explicit language.
Keep articles Effront-specific and link general React, Effect, Tailwind, and Comark concepts to official documentation.
Each locale has authored articles and a catalog, with no automatic translation or fallback to the other language.

### Place the article

| Section                       | Content                                                          |
| ----------------------------- | ---------------------------------------------------------------- |
| Getting started               | Initial application setup                                        |
| Platforms                     | Standalone Workers, Alchemy, and native Node.js/Bun setup        |
| Guides                        | Feature tasks, client navigation, and Server Function results    |
| Best practices                | Authentication and authorization, service lifetimes, and testing |
| API reference                 | Public exports and contracts                                     |
| Architecture / アーキテクチャ | Seven source-based implementation chapters                       |

Guides and Best practices list their articles directly, without a Runtime behavior subgroup.
Architecture chapters remain grouped under Implementation / 実装解説.
Keep contributor commands and framework test implementation out of the consumer testing article.

### Preserve URLs and heading links

Catalog paths omit locale prefixes; `src/content/locale.ts` owns the locale/path helpers.
The language switch links to the same article in the other language.
Article links, search results, and previous/next navigation stay in the selected language.

The collection strips `.md` but does not turn `index.md` into `/`.
The catalog maps public `/` to document `/index`, which has no public route of its own.
Link to `/en` or `/ja` for a localized home page, not `./index.md`.
Other relative `.md` links resolve through the collection with fragments preserved.

Keep published URLs and heading IDs when moving sidebar groups.
If a canonical URL changes, retain a compatibility route or permanent redirect.
Global HTTP middleware already redirects these retired paths for HTML and Flight, preserving the locale prefix and query string:

| Retired path                   | Destination                                                 |
| ------------------------------ | ----------------------------------------------------------- |
| `/advanced`                    | `/advanced/server-function-execution-and-refresh#execution` |
| `/advanced/production-startup` | `/platforms`                                                |
| `/guide/testing`               | `/best-practices/testing`                                   |
| `/platforms/node-bun`          | `/platforms`                                                |

Only the destinations appear in the catalog and navigation.
The `/advanced` redirect sets `#execution` explicitly, including for bookmarks with the former `#chapters` fragment.
The platform chooser retains the former Node.js/Bun heading IDs as anchor targets, including `node` and `bun` beside their respective guide links.
Content tests check catalog coverage, declared headings, and rendered internal article links.

## Content ownership and rendering

| Source                                                       | Responsibility                                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `src/content/en/articles/`, `src/content/articles/`          | English consumer Markdown and Japanese translations                                                    |
| `src/content/en/catalog.ts`, `src/content/catalog.ts`        | Navigation, descriptions, document lookup paths, and table of contents                                 |
| `src/content/markdown.tsx`                                   | Vite raw imports, `createMarkdownCollection`, `parseMarkdown`, and Comark `MarkdownDocument` rendering |
| `src/content/en/architecture/`                               | English implementation explanations                                                                    |
| `src/content/core-model.tsx`, `src/content/core-runtime.tsx` | Japanese implementation explanations and shared exact source selections                                |
| `src/entry.effront.tsx`                                      | Explicit routes and the persistent RootLayout                                                          |

Vite imports Markdown at build/development time.
Parsing runs in the Page Effect with `MarkdownError` in the error channel.
Each Vite module generation memoizes the locale collections and uses Effect's bounded `Cache` for up to 128 parsed documents, including syntax highlighting.
Concurrent lookups share in-progress parsing, successful results remain reusable, and failed lookups expire immediately.
HMR or a new build recreates the collections and parser cache, including their reference resolvers and parser configuration.
The application does not use a custom parser, runtime filesystem loader, Git execution, or network content loading.
Only rendered content and navigation metadata cross the client boundary, not the collection or highlighter.

Markdown permits HTML, attributes, and components; it is not a sanitizer for untrusted submissions.
Comark's standard renderer does not automatically register Math or Mermaid components, so do not promise their complete React SSR support.
See the [Markdown collection guide](../../../packages/markdown/docs/GUIDE.md) for reference resolution and renderer limitations.

### Code and shell rendering

The document starts in dark mode regardless of system preference.
Tailwind Typography styles articles, and Comark's Shiki output supplies server-rendered Markdown code tokens.
The `ProsePre` component mapping adds keyboard focus and code-block attributes without replacing Comark or reinterpreting its AST.
The `.docs-markdown` dark-theme CSS affects only Markdown tokens.
Architecture excerpts keep the exact-text `CodeBlock` renderer and locally imported Shiki grammars.
Neither renderer has a copy button; code remains selectable text.

Keep DocsShell in RootLayout so sidebar, search, header, table of contents, and sidebar scrolling survive route changes.
Only the Page article participates in the named page transition.
Do not add a route key to the shell or move its state into the Page.
Document scrolling and heading links use native navigation.
The deployment stylesheet remains explicitly selected through `effrontTailwind`, without a manual CSS import or extra runtime plugin.

## Production response caching

Caching is explicitly enabled by the docs Worker, not by the general-purpose Effront runtime.
Core applications retain `Cache-Control: private, no-store` unless they implement their own policy.
The docs site is public and request-independent: introducing authentication, cookies, experiments, or other personalized rendering requires revisiting this opt-in policy before deployment.

### Native Workers Cache and browser freshness

`src/entry.workers.ts` enables Cloudflare's [Workers Cache](https://developers.cloudflare.com/workers/cache/) with Alchemy's native `cache: { enabled: true }` option.
The installed Alchemy provider forwards this to the Worker version's `cacheOptions` metadata; no Cache Rules, custom cache store, `caches.default`, or response buffering is needed.
Cloudflare serves cache hits before executing the Worker, using tiered caching and request collapsing.
Workers Cache is distinct from both zone caching and the older Workers Cache API.

The docs response policy uses native Effect HTTP header transforms:

- `Cache-Control: public, max-age=0, must-revalidate` keeps fixed URLs fresh in browsers and downstream caches.
- `Cloudflare-CDN-Cache-Control: public, max-age=31536000` requests one-year retention only in Cloudflare's cache; Cloudflare consumes this header instead of forwarding it to clients.
- `Vary: Accept, Cookie, Authorization, X-Effront-Build-Id` partitions HTML/Flight and prevents a public cache hit from bypassing credential checks or the old-client guard.

Workers Cache explicitly honors `Vary`, unlike assumptions made about zone caching.
Its default key includes the path, full query string and Worker version, so `/en`, `/ja`, query variants and deployments are isolated without synthetic URLs or a purge job.
Do not enable cross-version caching.
The request hostname is not part of the native key; this site must continue to render the same public content across its hostnames.

Only public GET 200 HTML/Flight responses opt into the long edge TTL.
Development, credential-bearing requests, cookie-setting responses, non-200 responses and non-GET methods receive `private, no-store` in both cache-control headers.
Cloudflare can satisfy HEAD and Range from a cached GET itself; these do not imply execution of the origin's HEAD/Range branch.
HTTP caching does not inspect React's serialized payload: a render error encoded inside a normally completed HTTP 200 can be cached.
This policy does not add a core rendering observer or claim to exclude such application-level errors; verify authored pages before deployment and roll out a corrected version if necessary.
Response streams and their Effect scopes remain unchanged.
Hash-named `/assets/*` resources retain their one-year `immutable` policy via `_headers`.

Enabling Workers Cache changes billing: cache hits consume no Worker CPU, but all requests, including static assets, are billed at the standard Workers request rate.
See [Workers Cache pricing](https://developers.cloudflare.com/workers/cache/#pricing) before enabling the production deployment.

### Deployment generations and already-open tabs

Cloudflare isolates each deployed Worker version automatically.
The separate Vite build ID exists only for client/Flight compatibility, not for cache storage.
An optional `EFFRONT_BUILD_ID` must never be reused for different content or client assets.
HTML advertises that ID in `meta[name="effront-build-id"]`; the Flight client captures it once and sends `x-effront-build-id` on subsequent requests.
Missing or mismatched production Flight tokens receive `409` and `private, no-store`; the existing navigation fallback reloads the document before decoding Flight.
Including the token in `Vary` prevents the pre-Worker cache from returning a different client's compatible response instead of this rejection.
Server Function requests are not cached or automatically replayed.
Development disables the policy and guard so edits remain visible.

Deploy all Worker graphs and matching assets together.
The Flight guard does not solve initial HTML/asset races during multi-version gradual rollouts; those still require [version affinity and matching static assets](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/version-affinity/#static-assets).

The authentication-free local acceptance host verifies real rendered HTML/Flight, outgoing policy headers, navigation, and static asset headers, not the managed Cloudflare cache in front of the Worker.
After an authorized deployment, repeat HTML and Flight GETs and inspect Cloudflare's `Cf-Cache-Status: MISS` then `HIT`, correct content types and bodies, and the absence of the consumed `Cloudflare-CDN-Cache-Control` header.
Repeat with credentials and a missing/stale Flight token, then deploy changed content and verify the new article and an already-open tab.
These production cache and deployment-transition observations are not established by local tests.

Official specifications: [configuration and header precedence](https://developers.cloudflare.com/workers/cache/configuration/), [cache keys and version isolation](https://developers.cloudflare.com/workers/cache/cache-keys/), [limitations](https://developers.cloudflare.com/workers/cache/limitations/), and [static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/).

## Consumer compatibility and public packages

The API index must match the Effront manifest version and compatible React, Effect, Alchemy, and Comark versions.
Content tests compare it with every public manifest export and version, excluding internal build-only entries.
Do not bump library versions for private documentation-only changes.

All seven `0.1.3` packages were checked with read-only `vp view @effront/<package>@0.1.3 version --json` on 2026-09-18.
The `0.1.4` instructions target the next release, not a verified publication.
Check the registry before changing publication claims: a manifest does not establish publication.

Keep Bun production separate from Vite's Node-compatible dev/preview middleware when describing host support.
Vercel and AWS adapters remain deferred.

## Architecture source baseline

Keep implementation excerpts in JSX with their exact-string and historical-baseline contract.
The source of truth is `src/content/architecture-baseline.ts`: core version `0.1.1`, commit `8744ecb236cb4c815c3a0c208e02200f4eeeb3f8`, reviewed `2026-09-16`.
This identifies the source selections, not the latest documentation commit or current npm release.

`core.test.tsx` compares every selection with both the current source and the historical Git object, including the baseline package version.
Browser tests check the rendered excerpt text and displayed baseline metadata.
After deliberately reviewing an implementation change, update the explanations, source selections, and baseline metadata together.
A Markdown migration does not change this historical contract.

## Run locally

Run `vp install` and `vp exec --filter "./packages/*" -- vp pack` from the repository root before starting the application.
From `app/docs`, `vp run dev` invokes `alchemy dev` and serves `http://localhost:1339` after the local Worker is ready.
Bare `vp dev` bypasses Alchemy orchestration and is not the application's development entry.
The pinned Alchemy beta.77 requires a configured Cloudflare profile even for local CLI planning.
Do not force automated acceptance through this user-controlled prerequisite or supply fake credentials.
See [Alchemy integration](../../../packages/alchemy/docs/INTEGRATION.md) for official CLI setup and compatibility boundaries.
The separate built-site acceptance command below requires no Cloudflare authentication and performs no deployment.

## Validation

From the repository root, run `vp run check` and `vp run test` after the initial package bootstrap.
Site-owned unit tests cover catalogs, headings, internal links, public package coverage, Markdown rendering, persistent shell metadata, source baselines, and exact highlighted code text.

If ignored `tmp/` contains another checkout, use `vp test run --exclude '**/tmp/**'` for the full current-repository suite.
For a focused site run, use `vp test run app/docs/src --exclude '**/tmp/**'`.
Default discovery otherwise includes that checkout; the exclusion leaves unrelated worktrees unchanged.

From `app/docs`, run:

```sh
vp run test:browser
```

`tests/vite.config.ts` reuses the production config, Worker entry, styles, routes, and content, adding the local host pattern used by `tests/e2e-alchemy`.
The direct runtime host explicitly reads `public/_headers`, matching the file-to-asset-config step performed by Alchemy's deployment and local providers; acceptance also checks that the same rules reach `dist/client/_headers`.
It never evaluates `alchemy.run.ts`, invokes Alchemy planning, accesses cloud state, or deploys.
Playwright builds the site and runs the built Worker through preview on port `4394`, without server reuse.
Set `EFFRONT_DOCS_TEST_PORT` to a free port when another worktree is running acceptance.
This checks the built site's runtime behavior, not official CLI authentication or remote deployment.
Failure traces and screenshots stay under ignored `app/docs/tmp/`.

Browser acceptance covers:

- Routes without JavaScript, metadata, stable headings, and architecture excerpts.
- Initial CSS, dark highlighting, keyboard-reachable code, and mobile navigation/overflow.
- Unknown-route HTML/Flight 404 responses and the retired startup URL's HTML/Flight redirect and navigation absence.
- Persistent sidebar DOM, search, and scroll through sidebar, article, previous/next, and Back/Forward navigation.

Keep framework build and HMR acceptance in the independent fixtures described in [test boundaries](../../../docs/TESTING.md).
A successful build, source inspection, or mocked parser does not replace real site acceptance.

## Production deployment and state

This application uses `Cloudflare.state()` for shared remote state; the examples keep `localState()`.
The stack remains `effront-docs`, and production deployments always use stage `production` rather than a runner-specific default.
Local development keeps Alchemy's separate `dev_<user>` stage, but the docs state backend is Cloudflare, so do not assume that starting this application is credential-free or has no remote state-store operations.
Do not set `ALCHEMY_STAGE=production` when running `alchemy dev`.

The [Deploy documentation workflow](../../../.github/workflows/deploy-docs.yml) runs on pushes to `main` and can be dispatched manually from `main` only.
It builds the required workspace packages before invoking `vp exec alchemy deploy --stage production --yes` from `app/docs` directly in the workflow.
There is no package-level `deploy` script, to avoid accidental production deployment through a local task shortcut.
Repository checks and tests belong to the separate CI workflow and are not repeated or awaited by the deployment workflow.
Deployments are serialized without cancelling an in-progress reconciliation and do not run for pull requests or forks.
Alchemy builds the application as part of deployment; there is no separate Wrangler deployment or local-state artifact to restore.

Before enabling deployment, create the GitHub Environment `docs-production`, restrict it to `main`, and configure any required approval rules.
Set its variable `CLOUDFLARE_ACCOUNT_ID` and secret `CLOUDFLARE_API_TOKEN` for the intended Cloudflare account.
Credentials are passed only to the deployment step; Alchemy reads them directly in CI without a saved local profile.
The command uses `alchemy deploy --stage production --yes`, including automatic creation or upgrade of Alchemy's account-wide `alchemy-state-store` Worker when needed.
The API token must permit the docs Worker and assets deployment as well as state-store bootstrap/access, including its Durable Objects and Cloudflare Secrets Store resources; a token limited to uploading the docs Worker is not sufficient.
Review the pinned Alchemy provider's required permissions with the account administrator before the first run.
An Alchemy upgrade can also update this shared state-store Worker, so coordinate upgrades with other stacks in the same account.

Changing the backend does not migrate an existing local deployment's state.
If `effront-docs` has already been deployed with local state, preserve that state and complete an explicit migration or adoption review before running this workflow against the same resources.
Do not delete local state or assume that remote state will discover previously managed resources automatically.
For a new, never-deployed production stage, the first approved workflow run initializes remote state.
No cloud deployment or credential/permission validation is implied by local checks.

References: [Alchemy state stores](https://alchemy.run/state-store), [Cloudflare state implementation](https://github.com/alchemy-run/alchemy/blob/main/packages/alchemy/src/Cloudflare/StateStore/State.ts), and [Cloudflare authentication implementation](https://github.com/alchemy-run/alchemy/blob/main/packages/alchemy/src/Cloudflare/Auth/AuthProvider.ts).
API and CI behavior were checked against the installed `alchemy@2.0.0-beta.77`; the source URLs track upstream main.

## Sources and licenses

- [Comark React rendering](https://comark.dev/rendering/react).
- [Vite glob imports](https://vite.dev/guide/features.html#glob-import).
- [shadcn/ui Sidebar](https://ui.shadcn.com/docs/components/sidebar).
- [Shiki](https://shiki.style/) and its [JavaScript regex engine](https://shiki.style/guide/regex-engines).
- [Tailwind CSS Typography](https://github.com/tailwindlabs/tailwindcss-typography).
- [Third-party notices](../THIRD-PARTY-NOTICES.md).
