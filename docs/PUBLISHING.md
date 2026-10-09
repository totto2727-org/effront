# npm publication

All public libraries release together at the version declared in their package manifests, with public access and the `latest` dist-tag.
The release includes `@effront/core`, `@effront/vite`, `@effront/cloudflare`, `@effront/markdown`, `@effront/tailwind`, `@effront/alchemy`, and `@effront/server`, plus the `create-effront` initializer at the same version.

## Prepare a release

1. Bump every library and `create-effront` version together in the release pull request.
   Update generated starter dependencies with that release, but keep ordinary documentation installation commands unversioned.
2. When workspace peer ranges need updating, run `vp install --lockfile-only`.
3. Confirm that the package owner has configured npm Trusted Publishing for every package before relying on the workflow.

Publication has no automatic version bump or tag trigger.
The 0.3.0 release adopts stable Effect v4 and supersedes the Effect prerelease compatibility of 0.2.0.
Keep every Effront package at the matching release version.
The 0.3.1 patch release aligned generated starters with mature Vite Plus 1.0.0.
The 0.3.2 patch release uses caret dependencies and the latest compatible releases accepted by the default release-age policy.
It removes release-age exclusions and unnecessary overrides.
Only Vite+ prescribed Vite and matching Vitest overrides remain.
The workflow skips versions already on npm.

## Package builds

Each public library owns a `vite.config.ts` and uses `vp pack` to generate JavaScript and declarations.
`create-effront` also participates in the filtered build. Its publication must include the executable CLI and complete starter templates.
For the initial workspace build, call `vp exec --filter "./packages/*" -- vp pack` directly.
It builds in workspace dependency order without a package-name list or package-specific `dependsOn`.
Do not wrap this command in `vp run`: task discovery loads consumer configurations whose static imports require the package `dist/` exports to exist already.

Publication uses `vp run release:pack` to create the eight public package tarballs with Bun through `vp pm pack`.
Bun resolves `workspace:` and `catalog:` references while preserving their public caret and wildcard peer ranges.
The tarballs stay under ignored `tmp/npm-publish/`.
`vp run release:publish` depends on that packing task, checks each exact version with `vp info`, skips already-published versions, and uploads each missing version with `npm publish --provenance --access public --tag latest`.
Registry failures other than Bun's explicit missing-version result stop the task without attempting publication.
The root VitePlus task configuration owns both release entry points.
Do not run the publishing task without explicit authorization.
Preserve RSC module directives, runtime entry points, CSS assets, and conditional exports.

## Publication workflow and authorization

- `.github/workflows/ci.yml` runs checks and tests for pull requests and `main` updates.
- `.github/workflows/publish.yml` publishes on pushes to `main`, including merged pull requests, using the shared Nix and TypeScript setup actions on `@main`, followed by the repository-owned release task.
- All workflows install the Bun workspace with `vp install --frozen-lockfile` through the setup action.
- Bun is the sole dependency package manager, with workspace globs and catalogs in `package.json`, a single `bun.lock`, and a 24-hour minimum release age without exclusions in `bunfig.toml`.
- npm is used only to upload Bun-normalized tarballs through Trusted Publishing, not to install dependencies or create another lockfile.
- Publication is serialized.

Before merging the publishing workflow, the package owner must ensure that all npm packages exist and configure each Trusted Publisher with these values:

| Setting            | Value           |
| ------------------ | --------------- |
| GitHub owner       | `totto2727-org` |
| Repository         | `effront`       |
| Workflow           | `publish.yml`   |
| Publication        | Direct          |
| GitHub environment | None            |

The owner must perform initial publication if npm requires it, including the first `create-effront` release.
`vp create effront` resolves the published `create-effront` package, so the command is not available to registry consumers before this step.
The workflow uses GitHub-hosted runners and job-scoped `id-token: write`, without long-lived npm tokens.
Protect `main` and require the CI check before merging.
Local checks and dry runs do not verify registry trust or package ownership.

Bun 1.4.2 does not support npm Trusted Publishing/provenance or recursive filtered publication.
The actual VitePlus dry run of the former recursive command warns that Bun does not support `--provenance`, `--recursive`, or `--filter`, then attempts to publish the private root package.
Using npm only at the tarball upload boundary preserves GitHub OIDC without restoring a second dependency manager or a long-lived npm token.
Bun's [publishing options](https://bun.com/docs/pm/cli/publish) and [catalog publication behavior](https://bun.com/docs/pm/catalogs#publishing) document the supported Bun boundary.
References: [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) and [npm publish](https://docs.npmjs.com/cli/commands/npm-publish/).

## Alchemy release boundary

Alchemy participates in the same synchronized release as every other library under `packages/`.
Its public package retains the documented compatibility limits.
Inclusion in npm publication does not authorize infrastructure deployment.
First-time publication and Trusted Publisher setup for Alchemy remain package-owner prerequisites.
Refer to [Alchemy integration](../packages/alchemy/docs/INTEGRATION.md).

## Native server release boundary

`@effront/server` has separate Node, Bun, Vite, and assets entry points.
The owner must perform its first publication if needed and configure its Trusted Publisher before relying on automated releases.
Node and Bun host peers are optional. Applications must install the peer required by their selected entry, and Vite tooling requires the Node platform peer.
