# Effront documentation application

## Repository structure

- `src/content/articles/`: authored consumer Markdown, with typed route/navigation metadata in `src/content/catalog.ts`; architecture source chapters remain JSX in `src/content/`.
- `src/entry.effront.tsx`: explicit routes and shared layout.
- `docs/AUTHORING.md`: site operation, page authoring, baseline metadata, and site-specific verification.

## Development commands

### Standard tasks

- Run `vp install` and `vp exec --filter "./packages/*" -- vp pack` from the repository root before starting this application.
- `vp run dev` from this directory invokes `alchemy dev` and serves the site at `http://localhost:1339` once ready. Do not substitute bare `vp dev`, which bypasses Alchemy orchestration.
- `vp run test:browser` builds and exercises the actual site with an authentication-free local test host; failure traces stay under ignored `tmp/`.
- Root `vp run check` and `vp run test` include the site's colocated content, rendering, highlighting, and implementation-excerpt tests.

## Architecture

### Authored content and implementation excerpts

- Getting started and Guides explain Effront features for npm consumers, not repository contributors. Platforms owns host-specific setup; Best practices owns testing and other application-development recommendations without implying a framework-specific API. Guides nests application-facing runtime contracts without changing their `/advanced/*` URLs.
- Write Effront-specific explanations and link generic React/Effect concepts to official documentation. Keep developer commands here or in the authoring guide, not consumer testing pages.
- Consumer guides describe required steps, observable results, and actionable caveats. Keep internal wiring in Architecture; avoid explanations of mechanisms users do not need to configure or unsupported scenarios unrelated to the guide.
- Use the existing `@effront/markdown` collection/parser and standard Comark renderer for prose articles; preserve explicit routes and heading IDs and keep loading/parsing in the server graph.
- Architecture excerpts are authored exact source selections; never read the filesystem, execute Git, or fetch GitHub while rendering pages.
- Update source excerpts, explanations, and reviewed baseline metadata together when core changes. Tests compare the excerpts to both the current source and the explicit historical baseline.
- Keep shared DocsShell/sidebar/search/scroll state persistent through route changes; transition only the Page article, not the entire shell.
- Alchemy owns the host. Use the existing explicit Tailwind stylesheet through the Tailwind integration without a redundant manual CSS import or runtime plugin.
- Register `effront()` and `effrontAlchemy()` separately; application-entry options belong to `effront`, while the Alchemy adapter accepts only the native Worker entry.

## Task-specific documentation

- When adding pages, changing navigation, or updating baseline excerpts: [authoring and validation](docs/AUTHORING.md).
- When changing host integration or resolving profile prerequisites: [Alchemy integration](../../packages/alchemy/docs/INTEGRATION.md).
- When choosing framework browser acceptance instead of site-specific checks: [test boundaries](../../docs/TESTING.md).

_This AGENTS.md was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [AGENTS template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/agents/template.md)._
