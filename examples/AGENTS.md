# Effront examples

## Repository structure

- `alchemy/`: native Alchemy Worker with construction-provided KV capability and request-local services.
- `markdown/`: native Alchemy consumer of file-relative Markdown routing and assets.
- `workers/`: standalone Cloudflare consumer without Alchemy.
- `basic -> alchemy`: relative symlink, not a separate workspace package; preserve its exclusion in `pnpm-workspace.yaml`.

## Development commands

### Standard tasks

Run root `vp install` and `vp run w:pack` before entering an example.

- `vp run dev` in `alchemy/` or `markdown/` invokes `alchemy dev`; the native Worker owns ports 1337 and 1338 respectively.
- `vp dev`, `vp build`, and `vp preview` in `workers/` use standalone Cloudflare hosting, without an Alchemy profile or remote resources.
- `vp exec wrangler dev --config dist/rsc/wrangler.json --local --no-bundle` in `workers/` serves the built artifact independently of Vite after `vp build`.
- `vp run dev` from `basic/` must resolve to the native Alchemy example when changing the alias.
- `vp run test` in `../tests/e2e-alchemy/` checks the committed Alchemy consumer through a test-owned, auth-free host; official CLI acceptance is separate.

## Architecture

### Application entry and host ownership

- Export the application definition directly from `src/entry.effront.tsx`; do not restore a re-export-only `entry.client.ts`.
- Native Alchemy construction keeps its fixed deferred `entry.effront` import through `makeApplicationHttpEffect`; static imports would evaluate RSC application code during infrastructure planning.
- Alchemy CLI owns its Vite host. Do not add a manual runtime plugin, injection-environment guard, application stage fallback, or explicit stage flag to ordinary scripts.
- Standalone Workers uses its own Fetch entry, `effront()` plus `effrontCloudflare()`, and Wrangler configuration; keep its dependency graph free of Alchemy.

## Package-specific rules

- Keep examples minimal: introductory routes, Counter, Server Function, and framework features with Tailwind utilities, not custom transition demos or CSS.
- Put feature-independent React UI in `components/`; avoid redundant `Example` name prefixes.
- Group greeting behavior under `features/greeting/`: `server.ts` for Server Functions, `client.tsx` for feature UI, and `services.ts` for capabilities/services. Keep client/server directives in separate files, without re-export barrels.
- Use `effrontTailwind()` for generated styles; Markdown may select its Typography stylesheet explicitly. Do not hand-import styles in client shells or add ambient CSS types supplied by Vite.
- Verify visible SSR, hydration, Server Functions, navigation, and relevant CSS changes against the real host. Preserve existing independent regression fixtures rather than expanding the examples into test harnesses.

## Task-specific documentation

- When changing native host wiring or profile prerequisites: [Alchemy integration](../packages/alchemy/docs/INTEGRATION.md).
- When changing Markdown rendering or assets: [Markdown guide](../packages/markdown/docs/GUIDE.md).
- When changing standalone host boundaries: [Workers architecture](../docs/WORKERS.md).

_This AGENTS.md was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [AGENTS template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/agents/template.md)._
