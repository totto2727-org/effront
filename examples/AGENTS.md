# Effront examples

## Repository structure

- `minimal/node/`, `minimal/bun/`, `minimal/cloudflare/`, and `minimal/alchemy-cloudflare/`: minimal Node, Bun, standalone Cloudflare Workers, and Alchemy-managed Cloudflare Workers starters. Their `src/entry.effront.tsx` files must remain byte-identical; only hosting and infrastructure management differ.
- `alchemy/`: feature-rich native Alchemy Worker with construction-provided KV capability and request-local services.
- `markdown/`: feature-rich native Alchemy consumer of file-relative Markdown routing and assets.
- `workers/`: feature-rich standalone Cloudflare integration without Alchemy, separate from the minimal standalone Cloudflare starter.
- `node/` and `bun/`: feature-rich native Effect HTTP regression consumers with separate production runtimes.
- `basic -> alchemy`: relative symlink, not a separate workspace package; preserve its exclusion in `pnpm-workspace.yaml`.

See [example selection](README.md) for runnable commands and the distinction between platform starters and feature demonstrations.

## Development commands

### Standard tasks

Run root `vp install` and `vp exec --filter "./packages/*" -- vp pack` before entering an example.
Workspace preparation is separate from development startup; example development commands do not build workspace packages.

- `vp dev` in `minimal/node/` and `minimal/bun/` starts the minimal Vite host on an available port after root preparation. Use `vp build` followed by `vp run start` for their separate Node and Bun native production listeners; set `PORT` or `HOST` to override the server defaults.
- `vp dev` in `minimal/cloudflare/` starts the minimal standalone Cloudflare Worker on an available Vite port; `vp build` emits its Worker artifact without Alchemy.
- `vp exec wrangler dev --config dist/rsc/wrangler.json --local` in `minimal/cloudflare/` serves the built artifact independently of Vite after `vp build`.
- `vp run dev` in `minimal/alchemy-cloudflare/` starts the minimal Alchemy-managed Worker without a fixed development port.
- `vp run dev` in `alchemy/` or `markdown/` invokes `alchemy dev`; the native Worker owns ports 1337 and 1338 respectively.
- `vp dev` and `vp build` in `workers/` use standalone Cloudflare hosting, without an Alchemy profile or remote resources. Vite chooses an available development port.
- `vp exec wrangler dev --config dist/rsc/wrangler.json --local` in `workers/` serves the built artifact independently of Vite after `vp build`.
- `vp dev`, `vp build`, and `vp run start` in `node/` or `bun/` exercise Vite tooling and the separate built native listener. `PORT` and `HOST` configure production listening.
- `vp run dev` from `basic/` must resolve to the native Alchemy example when changing the alias.
- `vp run test` in `../tests/e2e-alchemy/` checks the committed Alchemy consumer through a test-owned, auth-free host; official CLI acceptance is separate.

## Architecture

### Application entry and host ownership

- Export the application definition directly from `src/entry.effront.tsx`; do not restore a re-export-only `entry.client.ts`.
- Native Alchemy construction keeps its fixed deferred `entry.effront` import through `makeApplicationHttpEffect`; static imports would evaluate RSC application code during infrastructure planning.
- Alchemy CLI owns its Vite host. Do not add a manual runtime plugin, injection-environment guard, application stage fallback, or explicit stage flag to ordinary scripts.
- Native Alchemy consumers register `effront()` plus `effrontAlchemy()`. Configure `application` only on `effront` and the native `worker` only on `effrontAlchemy`; keep the existing Tailwind integration separate.
- Node/Bun use `entry.rsc.ts` for the native handler and `entry.server.ts` for production listening; never start the production server during Vite development.
- Standalone Workers examples use a Fetch entry, `effront()` plus `effrontCloudflare()`, and Wrangler configuration; keep their dependency graphs free of Alchemy. Alchemy-managed examples instead use `effrontAlchemy()` and an Alchemy Worker definition.
- Starter application code is exactly the same on Node, Bun, standalone Cloudflare, and Alchemy Cloudflare. Do not put platform branding, service wiring, feature demos, or deployment configuration in their `entry.effront.tsx` files.

## Package-specific rules

- Keep all four `minimal/*` starters limited to one heading and host configuration; verify their documented startup without adding Counter, Server Functions, or styling.
- Keep feature showcases focused: introductory routes, Counter, Server Function, and framework features with Tailwind utilities, not custom transition demos or CSS.
- Put feature-independent React UI in `components/`; avoid redundant `Example` name prefixes.
- Group greeting behavior under `features/greeting/`: `server.ts` for Server Functions, `client.tsx` for feature UI, and `services.ts` for capabilities/services. Keep client/server directives in separate files, without re-export barrels.
- Use `effrontTailwind()` for generated styles; Markdown may select its Typography stylesheet explicitly. Do not hand-import styles in client shells or add ambient CSS types supplied by Vite.
- Verify visible SSR, hydration, Server Functions, navigation, and relevant CSS changes against the real host. Preserve existing independent regression fixtures rather than expanding the examples into test harnesses.

## Task-specific documentation

- When changing native host wiring or profile prerequisites: [Alchemy integration](../packages/alchemy/docs/INTEGRATION.md).
- When changing Markdown rendering or assets: [Markdown guide](../packages/markdown/docs/GUIDE.md).
- When changing standalone host boundaries: [Workers architecture](../docs/WORKERS.md).
- When exploring or changing Node Loading/Suspense examples: [playground guide](node/docs/LOADING.md).

_This AGENTS.md was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [AGENTS template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/agents/template.md)._
