# Alchemy adapter development

## Repository structure

- `src/cloudflare/index.ts` owns deferred application loading and capability capture.
- `src/cloudflare/vite.ts` owns the native Worker bridge and compilation graphs, not application hosting.
- `src/cloudflare/runtime-projection.ts` owns the version-pinned development runtime export projection.
- Future providers belong in sibling directories under `src/` with explicit package subpaths, not in core or the Cloudflare entry.

## Development commands

### Execution rules

- Preparing this private package for local linking uses the [repository installation and workspace build commands](../../AGENTS.md#development-commands). The prepared checkout must retain its dependencies and built `dist/` exports while a consumer links it.
- Keep `@effront/alchemy` private and all prototype package versions at `0.1.1`. Do not add it to release filters, publish it, or deploy the prototype without a separate user decision.
- Alchemy CLI owns the migrated application host. Do not register a manual `@alchemy.run/cloudflare-runtime` plugin or an injection-environment guard in application Vite configuration.
- The fixed browser test owns its own standalone workerd host and local KV configuration. Credential-free acceptance does not prove official CLI planning is authentication-free.
- The pinned CLI requires a configured Cloudflare profile before planning even locally supported Worker/KV resources. Do not invent credentials or deploy resources to bypass this prerequisite.

### Standard tasks

- From the repository root after shared package preparation, `vp test run packages/alchemy` checks lazy construction, context filtering, Vite composition, and the pinned runtime projection.
- From `tests/e2e-alchemy/`, `vp run test` builds and serves the committed KV example and checks native HTML, HEAD, hydration, Server Functions, navigation, Tailwind styling, and narrow-screen layout. See the [test package instructions](../../docs/TESTING.md#native-alchemy-integration).
- For official CLI consumers, follow the [example commands and ports](../../examples/AGENTS.md#development-commands) or [documentation-site commands](../../app/docs/AGENTS.md#development-commands). Bare `vp dev` bypasses the Alchemy orchestration those consumers require.
- When the user chooses to configure the required profile, `vp exec alchemy profile edit --profile default --add Cloudflare` is the interactive CLI command. Profile authentication is user-controlled and distinct from cloud deployment.

Stage selection follows Alchemy defaults: `ALCHEMY_STAGE` when configured, otherwise `dev_${USER}`.
The application script must not force a shared stage.
Local state belongs in ignored `.alchemy/` directories through `localState()`.
An isolated empty-profile CLI check previously failed with `Provider 'Cloudflare' is not configured in profile 'default'`; a configured profile allows reconciliation of locally supported resources without proving remote permissions or deployment.

## Architecture

### Native construction and requests

- Defer application and core HTTP imports until the live RSC request. Native Worker construction runs in the deployment tool and during isolate initialization.
- Capture capability references rather than their lifetimes. Acquire application Layers per request and let the official Alchemy bridge retain streaming scopes.
- Omit host-owned services from captured context and merge live request services over captured application capabilities. Preserve explicitly required non-host services, including named container application capabilities.
- Preserve typed application failures until the Worker's HTTP boundary maps them to the host's narrower error contract.
- Use Alchemy's official `makeWorkerBridge`, the `rsc` entry with `ssr` child, and injected stack/stage bindings. Do not compete with the adapter's entry by setting `vite.main`.

### Pinned runtime projection

- Keep Alchemy and Cloudflare runtime at `2.0.0-beta.77` with the coherent Effect `4.0.0-rc.112` family until a deliberate compatibility review. Beta.77 uses `Config.string`, which is incompatible with rc.113's renamed API despite its broad dependency range.
- Projection is optimizer-only and forwards to installed runtime modules with Alchemy's official purity transform. Never copy Alchemy implementations or change deployment-time construction imports.
- Fail on unsupported Alchemy versions or missing internal modules. Expanding the Worker/KV surface requires reviewing both runtime-projection implementation and tests.
- Preserve explicit optimizer entries and React/Effect deduplication to prevent mixed cold-start module identities.
- Keep default SSR output inside the RSC artifact while preserving explicit output directories. The host must package explicitly relocated modules together.

## Task-specific documentation

- When changing public helpers or supported runtime capabilities: [adapter API](docs/API.md).
- When changing version compatibility, scope transfer, or native KV integration: [integration architecture and evidence](docs/INTEGRATION.md).
- When changing standalone compatibility rather than native hosting: [Workers architecture](../../docs/WORKERS.md).

_This AGENTS.md was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [AGENTS template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/agents/template.md)._
