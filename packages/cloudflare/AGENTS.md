# Cloudflare adapter development

## Repository structure

- `src/index.ts` owns Vite integration and SSR output nesting.
- `src/workers.ts` is the runtime-only request-reader entry and must not import the Vite plugin.
- `tests/cloudflare.test.ts` resolves real Vite configuration against `tests/fixtures/` to verify plugin composition and output paths.

## Development commands

After the [repository build prerequisites](../../AGENTS.md#development-commands), run `vp test run packages/cloudflare` from the repository root for runtime readers and real Vite configuration integration.
Changes to host wiring also need the applicable [built Worker](../../docs/TESTING.md#independent-test-ownership) and [Vite HMR](../../docs/TESTING.md#independent-test-ownership) acceptance paths; these independently exercise standalone Fetch hosting rather than native Alchemy orchestration.

## Architecture

- The plugin always wires the `rsc` Worker environment with `ssr` as its child and leaves browser/RSC/SSR compilation to the separately registered `effront()` integration.
- Default SSR output belongs beneath the RSC Worker upload directory. Preserve explicit SSR output paths and forwarding of all Cloudflare options except invariant `viteEnvironment` wiring.
- Accessors delegate to the core request Context without allocating another service or Layer. Preserve object identity and the Env-only generic factory with its fixed minimal `waitUntil` execution-context contract.
- Keep plugin configuration separate from runtime imports and preserve the explicit `./workers` export.
- Standalone Cloudflare compatibility tests remain separate from Alchemy's native Worker integration; do not register this host in Alchemy application Vite configs.

## Task-specific documentation

- When changing the public plugin or typed readers: [Cloudflare API](README.md#api).
- When changing generated Worker artifacts or host boundaries: [Workers architecture](../../docs/WORKERS.md).

_This AGENTS.md was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [AGENTS template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/agents/template.md)._
