# SSR documentation site

`app/docs` is the private Japanese documentation application, rendered on each request by Effront and hosted by Alchemy's native Cloudflare integration.
Its consumer navigation is Getting started, Platforms, Guides, Best practices, API reference, and アーキテクチャ.
Guides nests application-facing runtime contracts under 実行時の契約; Architecture nests the seven source-based chapters under 実装解説.
Best practices contains application-development recommendations rather than framework features.
When a canonical article URL changes, preserve bookmarks through a permanent redirect.
The retired `/advanced/production-startup` article redirects permanently to `/platforms` through native global HTTP middleware, for both HTML and Flight requests, and is absent from the catalog/navigation.
The former `/guide/testing` URL similarly redirects to `/best-practices/testing`; only the latter appears in the catalog.

## Run locally

Run `vp install` and `vp exec --filter "./packages/*" -- vp pack` from the repository root before starting the application.
From `app/docs`, `vp run dev` invokes `alchemy dev` and serves `http://localhost:1339` after the local Worker is ready.
Bare `vp dev` bypasses Alchemy orchestration and is not the application's development entry.
The pinned Alchemy beta.77 requires a configured Cloudflare profile even for local CLI planning.
Do not force automated acceptance through this user-controlled prerequisite or supply fake credentials.
See [Alchemy integration](../../../packages/alchemy/docs/INTEGRATION.md) for official CLI setup and compatibility boundaries.
The separate built-site acceptance command below requires no Cloudflare authentication and performs no deployment.

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

## Content ownership and rendering

- `src/content/articles/` contains consumer articles in Markdown: onboarding, platforms, feature guides, runtime contracts, and public API reference.
- `src/content/catalog.ts` owns typed navigation metadata, descriptions, explicit public routes, source-document lookup paths, and table-of-contents entries.
- `src/content/markdown.tsx` uses Vite raw globs, `createMarkdownCollection`, `parseMarkdown`, and Comark's standard `MarkdownDocument` renderer in the server graph.
- `src/content/core-model.tsx` and `core-runtime.tsx` retain the authored architecture explanations and exact source selections as JSX.
- `src/entry.effront.tsx` owns explicit routes and the persistent shared RootLayout.

Markdown is appropriate for the prose and code examples, but source excerpts retain their exact-string and historical-baseline contract in JSX.
There is no custom Markdown parser, runtime filesystem loader, Git execution, or network content loading in the application.
Vite loads Markdown at build/development time; parsing occurs in the Page Effect, with `MarkdownError` retained in the error channel.
Only rendered content and navigation metadata cross the client boundary, not the collection or highlighter.

The document starts in dark mode regardless of system preference.
Tailwind Typography styles articles; Comark's standard Shiki output supplies server-rendered code tokens for Markdown.
A standard `ProsePre` component mapping adds keyboard focus and existing code-block attributes without replacing Comark or reinterpreting its AST.
The `.docs-markdown` dark-theme CSS applies only to Markdown tokens.
Architecture excerpts retain the site's exact-text `CodeBlock` and its locally imported Shiki grammars.
Neither renderer currently provides a copy button; code remains selectable text.

The RootLayout owns DocsShell, including sidebar, search, header, table of contents, and sidebar scrolling.
Only the Page article participates in the named page transition.
Do not put a route key on the shell or move shell state into the Page when changing article rendering.
Document scrolling and heading links remain native navigation behavior.
The deployment stylesheet remains explicitly selected through `effrontTailwind`, without a manual CSS import or extra runtime plugin.

## Author or change an article

1. Add a trusted authored `.md` file below `src/content/articles/`.
2. Add its metadata to `articleCatalog`, choosing the consumer section and optional group.
3. Give each heading a stable explicit Comark ID, such as `## セットアップ {#setup}`, and list its ID/title in `headings`.
4. Add the explicit route in `src/entry.effront.tsx`; registration preserves compile-time collision checks and native unknown-route 404 behavior.
5. Run the content tests and built-site browser acceptance below.

The collection strips only `.md`; it does not turn `index.md` into `/`.
The catalog deliberately maps public `/` to document `/index`, without exposing `/index` as another route.
Use site-absolute `/` when linking to the home page, not `./index.md`, which would resolve to the intentionally unregistered `/index`.
Other relative `.md` links are resolved by the existing collection, with fragments preserved.
Keep published URLs and heading IDs when moving sidebar groups; if a URL must change, supply an intentional compatibility route or redirect rather than silently dropping it.
Tests check every Markdown file has catalog metadata, every declared heading exists, and all rendered internal article links resolve.

Use fenced code blocks with an explicit language.
Keep articles Effront-specific and link general React, Effect, Tailwind, and Comark concepts to their official documentation.
Markdown allows HTML, attributes, and components and is not a sanitizer for untrusted submissions.
Do not imply complete Math or Mermaid React SSR: the standard Comark renderer does not automatically register those components.
See [Markdown collection guide](../../../packages/markdown/docs/GUIDE.md) for reference resolution and renderer limitations.

## Consumer compatibility and public packages

The API index documents the matching Effront manifest version and compatible React, Effect, Alchemy, and Comark versions.
The preceding `0.1.3` release was checked with read-only `vp view @effront/<package>@0.1.3 version --json` for all seven public packages on 2026-09-18.
The `0.1.4` instructions target the next release and do not claim it has already been published.
A manifest alone does not prove registry publication; check the registry before changing publication claims.
The content test compares the index with every public manifest export and version, excluding internal build-only entries.
Do not bump library versions for private documentation-only changes.

Platforms owns standalone Workers, Alchemy, and native Node.js/Bun setup.
Bun production and Vite's Node-compatible dev/preview middleware are separate execution paths.
Vercel and AWS adapters remain deferred rather than advertised as supported.
The consumer testing article describes application behavior, not contributor commands or framework test implementation.

## Architecture source baseline

The architecture source of truth is `src/content/architecture-baseline.ts`: core version `0.1.1`, commit `8744ecb236cb4c815c3a0c208e02200f4eeeb3f8`, reviewed `2026-09-16`.
This describes the implementation selections, not the latest documentation commit or current npm release.
`core.test.tsx` compares every exact source selection against both the current source and that historical Git object, and checks the baseline package version.
The browser tests verify the rendered excerpt text and displayed baseline metadata as well.
Update explanations, source selections, and baseline metadata together only after deliberately reviewing an implementation change.
The Markdown migration does not update or reinterpret this historical contract.

## Validation

From the repository root, run `vp run check` and `vp run test` after the initial package bootstrap.
Site-owned unit tests cover the catalog, all article headings and internal links, public package coverage, Markdown rendering, persistent shell metadata, source baselines, and exact highlighted code text.
If ignored `tmp/` contains another checkout, run the full current-repository suite with `vp test run --exclude '**/tmp/**'`; the default test discovery otherwise includes that checkout.
For a focused site run, use `vp test run app/docs/src --exclude '**/tmp/**'`.
The exclusion avoids discovering unrelated old worktrees under ignored `tmp/` without changing or deleting them.

From `app/docs`, run:

```sh
vp run test:browser
```

`tests/vite.config.ts` reuses the production application config, Worker entry, styles, routes, and content, adding only the local runtime host pattern already used by `tests/e2e-alchemy`.
It never evaluates `alchemy.run.ts`, invokes Alchemy planning, accesses cloud state, or deploys.
Playwright builds the actual site and runs the built Worker through preview on fixed port `4394`, with no server reuse.
This is built-site runtime evidence, not evidence about official CLI authentication or remote deployment.
Failure traces and screenshots stay under ignored `app/docs/tmp/`.

Browser acceptance covers all routes without JavaScript, metadata, stable headings, architecture excerpts, initial CSS, dark highlighting, keyboard-reachable code, mobile navigation/overflow, unknown-route HTML/Flight 404 responses, the retired startup URL’s HTML/Flight redirect and navigation absence, and persistent sidebar DOM/search/scroll through sidebar, article, previous/next and Back/Forward navigation.
Framework-only build and HMR suites retain their independent fixtures and commands described in [test boundaries](../../../docs/TESTING.md).
Do not substitute a successful build, source inspection, or mocked parser for the real site acceptance workflow.

## Sources and licenses

- [Comark React rendering](https://comark.dev/rendering/react).
- [Vite glob imports](https://vite.dev/guide/features.html#glob-import).
- [shadcn/ui Sidebar](https://ui.shadcn.com/docs/components/sidebar).
- [Shiki](https://shiki.style/) and its [JavaScript regex engine](https://shiki.style/guide/regex-engines).
- [Tailwind CSS Typography](https://github.com/tailwindlabs/tailwindcss-typography).
- [Third-party notices](../THIRD-PARTY-NOTICES.md).
