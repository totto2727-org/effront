# npm publication

All public libraries release together at version `0.1.4` with public access and the `latest` dist-tag.
The release includes `@effront/core`, `@effront/vite`, `@effront/cloudflare`, `@effront/markdown`, `@effront/tailwind`, `@effront/alchemy`, and `@effront/server`.

## Prepare a release

1. Bump every library version together in the release pull request.
2. When workspace peer ranges need updating, run `vp install --lockfile-only`.
3. Confirm that the package owner has configured npm Trusted Publishing for every package before relying on the workflow.

Publication has no automatic version bump or tag trigger.
The workflow skips versions already on npm.

## Package builds

Each public package owns a `vite.config.ts` and uses `vp pack` to generate JavaScript and declarations.
For the initial workspace build, call `vp exec --filter "./packages/*" -- vp pack` directly.
It builds in workspace dependency order without a package-name list or package-specific `dependsOn`.
Do not wrap this command in `vp run`: task discovery loads consumer configurations whose static imports require the package `dist/` exports to exist already.

Publication uses filtered `vp pm publish -r` to resolve `workspace:` and `catalog:` ranges and create tarballs.
The build and publication workflows do not stage or extract tarballs.
Preserve RSC module directives, runtime entry points, CSS assets, and conditional exports.

## Publication workflow and authorization

- `.github/workflows/ci.yml` runs checks and tests for pull requests and `main` updates.
- `.github/workflows/publish.yml` publishes on pushes to `main`, including merged pull requests, using the shared Nix, TypeScript setup, and `publish-npm` actions on `@main`.
- The publisher runs `vp pm publish -r --provenance` with the single directory filter `./packages/*`.
- Publication is serialized.

Before merging the publishing workflow, the package owner must ensure that all npm packages exist and configure each Trusted Publisher with these values:

| Setting            | Value           |
| ------------------ | --------------- |
| GitHub owner       | `totto2727-org` |
| Repository         | `effront`       |
| Workflow           | `publish.yml`   |
| Publication        | Direct          |
| GitHub environment | None            |

The owner must perform initial publication if npm requires it.
The workflow uses GitHub-hosted runners and job-scoped `id-token: write`, without long-lived npm tokens.
Protect `main` and require the CI check before merging.
Local checks and dry runs do not verify registry trust or package ownership.

References: [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) and [pnpm publish](https://pnpm.io/cli/publish).

## Alchemy release boundary

Alchemy participates in the same `0.1.4` release as every other library under `packages/`.
Its public package retains the documented compatibility limits; inclusion in npm publication does not authorize infrastructure deployment.
First-time publication and Trusted Publisher setup for Alchemy remain package-owner prerequisites.
See [Alchemy integration](../packages/alchemy/docs/INTEGRATION.md).

## Native server release boundary

`@effront/server` has separate Node, Bun, Vite, and assets entry points.
The owner must perform its first publication if needed and configure its Trusted Publisher before relying on automated releases.
Node and Bun host peers are optional; applications must install the peer required by their selected entry, and Vite tooling requires the Node platform peer.
