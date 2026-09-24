# Vercel adapter

## Repository structure

- `src/vite.ts` owns Vite integration and the generated serverless entry.
- `src/runtime.ts` owns native Node handler construction, not a network listener.
- `src/output.ts` owns Build Output v3 staging and replacement.
- `tests/build.test.ts` builds the existing Node example and invokes its generated function over real HTTP.

## Development commands

After the root package bootstrap, run `vp exec --filter @effront/vercel -- vp pack` and `vp test run packages/vercel` from the repository root.
The build test uses package `dist` to exercise the published plugin and copies its consumer into this package's ignored `tmp/`.
Do not mutate the shared Node example or require Vercel authentication for acceptance.

## Architecture

The adapter reuses `@effront/server/vite` for native development and preview.
Production emits a listener-free Node request/response handler and bundles RSC and SSR separately with `noExternal: true`.
The RSC build must finish writing its cross-environment manifests before packaging starts.
Keep RSC/SSR sibling paths intact and server artifacts out of the static directory.
Do not claim dependency tracing, arbitrary runtime-file packaging, native-addon support, or hosted platform validation from these local tests.

## Package-specific rules

- Follow the root catalog and publication policy.
- Preserve previous successful output during packaging failures, including failed directory replacement.
- Await every filesystem operation before cleaning temporary output.
- Native streaming completion and disconnect must release request scopes without closing services shared by warm invocations.
- Vercel deployments remain explicitly authorized manual validation; local Node cannot verify platform routing, limits, billing, or cancellation propagation.

_This AGENTS.md was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [AGENTS template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/agents/template.md)._
