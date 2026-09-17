# Effront documentation application

## Repository structure

- `src/content/`: authored Guide, Platforms, Advanced, API, and Architecture pages.
- `src/entry.effront.tsx`: explicit routes and shared layout.
- `docs/AUTHORING.md`: site operation, page authoring, baseline metadata, and site-specific verification.

## Development commands

### Standard tasks

- Run `vp install` and `vp run w:pack` from the repository root before starting this application.
- `vp run dev` from this directory invokes `alchemy dev` and serves the site at `http://localhost:1339` once ready. Do not substitute bare `vp dev`, which bypasses Alchemy orchestration.
- Root `vp run check` and `vp run test` include the site's colocated content, rendering, highlighting, and implementation-excerpt tests.

## Architecture

### Authored content and implementation excerpts

- Guide is for npm consumers, not repository contributors; Platforms owns host-specific setup, and Advanced owns application-facing guarantees.
- Write Effront-specific explanations and link generic React/Effect concepts to official documentation. Keep developer commands here or in the authoring guide, not consumer testing pages.
- Architecture excerpts are authored exact source selections; never read the filesystem, execute Git, or fetch GitHub while rendering pages.
- Update source excerpts, explanations, and reviewed baseline metadata together when core changes. Tests compare the excerpts to both the current source and the explicit historical baseline.
- Keep shared DocsShell/sidebar/search/scroll state persistent through route changes; transition only the Page article, not the entire shell.
- Alchemy owns the host. Use the existing explicit Tailwind stylesheet through the Tailwind integration without a redundant manual CSS import or runtime plugin.

## Task-specific documentation

- When adding pages, changing navigation, or updating baseline excerpts: [authoring and validation](docs/AUTHORING.md).
- When changing host integration or resolving profile prerequisites: [Alchemy integration](../../packages/alchemy/docs/INTEGRATION.md).
- When choosing framework browser acceptance instead of site-specific checks: [test boundaries](../../docs/TESTING.md).

_This AGENTS.md was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [AGENTS template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/agents/template.md)._
