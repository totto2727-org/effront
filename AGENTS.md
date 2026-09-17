# Effront

## Repository structure

- `packages/`: core runtime, provider adapters, build integrations, Markdown support, and development tooling; consult a package's local `AGENTS.md` for its unique constraints.
- `examples/`: native Alchemy and standalone Workers consumers; `basic -> alchemy` is an alias excluded from workspace discovery.
- `app/docs/`: the framework's own SSR documentation application.
- `tests/`: independent browser integration packages, distinct from package-owned unit and integration tests.
- [Documentation index](docs/INDEX.md): cross-package architecture, testing, release policy, roadmap, and upstream provenance only; single-owner guides belong under that package's `docs/`.

## Development commands

### Execution rules

- Work in this independent repository at `workspace/package/effront/`, not the parent virtual monorepo.
- Push and open pull requests only in `totto2727-org/effront`, never upstream. Do not publish packages or deploy without explicit authorization.
- Use VitePlus for package management, formatting, linting, checks, and test entry points; retain its default formatting and lint rules.
- Keep temporary evidence under the owning repository or package's ignored `tmp/`; never commit credentials, `.dev.vars`, generated output, or temporary reports.
- Automated local acceptance must not require Cloudflare authentication or remote services. Official Alchemy CLI development has a separate profile prerequisite documented by its adapter; do not force verification through an authentication boundary.

### Standard tasks

Run from the repository root:

- `vp install` installs workspace dependencies; `vp install --frozen-lockfile` checks reproducible installation.
- `vp run w:pack` builds package JavaScript and declarations recursively in workspace dependency order. Run it before checks, tests, or consumers that resolve `dist/` exports.
- `vp run fix` applies formatting and safe lint fixes through `js:fix`.
- `vp run check` runs formatting, lint, and types through `js:check`.
- `vp run test` runs unit/integration tests through `js:test`; browser suites remain package-local.
- Public packages own their `vite.config.ts` pack settings and `vp pack`/`vp run pack` tasks. These generate `dist/`, not npm tarballs.

Root aggregates live in `vite.config.ts` `run.tasks`, not duplicated package scripts.
Do not add redundant formatter/linter or root application/E2E runner tasks.
Choose checks appropriate to the change, using the detailed test boundaries below.

## Architecture

### Runtime and build boundaries

- Core exposes host-neutral native Effect HTTP and a compatibility Web Fetch boundary. Provider-specific code belongs in adapters, never core.
- Keep browser, RSC, SSR, and tooling graphs explicit. Only RSC resolves `react-server`; RSC and SSR execute in workerd for the current Cloudflare hosts, not Node fallback.
- Scope application services to a request and retain their lifetimes through response completion, error, or cancellation. Never implicitly serialize host bindings or execution context into Flight/HTML.
- Preserve native React RSC and Server Function protocols. Node/Bun/AWS/Vercel hosting remains deferred; do not restore the removed Bun/Rspack runtime or imply unverified support.

## Development tools

- **VitePlus**: pinned in `pnpm-workspace.yaml`; root config owns shared checks and standard Vitest discovery.
- **Gitignore exclusions**: `vite.config.ts` uses the published [JSR package](https://jsr.io/@totto2727/gitignore-patterns), versioned in the catalog. Do not restore a vendored implementation or its upstream tests.
- **Effect**: consult installed-version source and official documentation before changing APIs.
- **Playwright/workerd**: browser acceptance exercises actual host behavior; a successful build or mock does not establish runtime correctness.

## Package-specific rules

- Manage all external dependency versions in the shared catalog, including single consumers; use `catalog:` in manifests and overrides.
- Keep internal references as `workspace:`. Public Vite peers stay `"*"` to accept the consumer's Vite, while development uses the catalog-pinned VitePlus alias.
- Preserve explicit public subpaths, package-owned pack settings, and test-excluding publication entries. Shared release requirements and the experimental `0.1.1` version exception live in the release policy below.
- Use path-qualified Effect service identifiers and implementation-free shared contracts. Use `Effect.fnUntraced` for internals, `Effect.fn` for application/examples/public API authoring, and typed failures for input/I/O; reserve `TypeError` for violated wiring invariants.
- Colocate unit tests as `<module>.test.ts(x)`; reserve `tests/` for integration or black-box contracts. Keep all retained source/tests checked and standard Vitest discovery; Playwright uses `*.e2e.ts`.
- Follow `share-artifact` for README/AGENTS: README is consumer-facing, Setup uses normal installation rather than `workspace:`/`catalog:`, and Development links to AGENTS. Package AGENTS supplements, not duplicates, root rules.
- Keep user-facing guides host-neutral unless describing a specific platform. Describe only implemented guarantees; put deferred designs in the roadmap.

## Task-specific documentation

- When changing a package: its local `AGENTS.md` and `docs/` own package-specific implementation and verification details.
- When changing samples: [example rules and commands](examples/AGENTS.md).
- When authoring or operating the documentation application: [site rules](app/docs/AGENTS.md).
- When choosing unit, integration, browser, or HMR checks: [test boundaries](docs/TESTING.md).
- When changing package publication or versions: [release policy](docs/PUBLISHING.md).
- When changing core/Vite/Cloudflare boundaries together: [Workers architecture](docs/WORKERS.md).
- When proposing deferred hosts or features: [roadmap](docs/ROADMAP.md).
- When incorporating upstream changes or license material: [upstream provenance](docs/UPSTREAM.md).

_This AGENTS.md was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [AGENTS template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/agents/template.md)._
