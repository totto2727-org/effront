# npm publication

- `.github/workflows/ci.yml` runs checks and tests for pull requests and `main` updates.
- `.github/workflows/publish.yml` publishes on pushes to `main`, including merged pull requests, using the shared Nix, TypeScript setup, and `publish-npm` actions on `@main`. The publisher runs `vp pm publish -r --provenance` with the single directory filter `./packages/*`; do not maintain a package-name list.
- Publication is serialized and skips versions already on npm. Bump all six library versions together in each release pull request and update workspace peer ranges through `vp install --lockfile-only` when needed. There is no automatic version bump or tag trigger.
- Public packages are `@effront/core`, `@effront/vite`, `@effront/cloudflare`, `@effront/markdown`, `@effront/tailwind`, and `@effront/alchemy`.
- Each public package owns a `vite.config.ts` and runs only `vp pack` for JavaScript and `.d.ts`. `vp exec --filter "./packages/*" -- vp pack` follows workspace dependencies without a hand-maintained list or package-specific `dependsOn`. Unlike `vp run`, it does not discover consumer task configurations whose static imports require not-yet-built `dist/` exports. Call it directly for the initial build, not through a `vp run` wrapper. Publication uses filtered `vp pm publish -r`, which resolves `workspace:` and `catalog:` protocols, creates the tarballs, and skips versions already on npm. No tarball staging or extraction is part of the build or publish workflow. Preserve RSC module directives, runtime entry points, CSS assets, and conditional exports.
- The public packages use version `0.1.2` and use public access with the `latest` dist-tag through `publishConfig`.
- Before merging the publishing workflow, the package owner must ensure all six npm packages exist and configure each Trusted Publisher for GitHub owner `totto2727-org`, repository `effront`, workflow `publish.yml`, and direct publication. No GitHub environment is configured. Initial publication, if required by npm, must be performed by the owner.
- The workflow uses GitHub-hosted runners and job-scoped `id-token: write`, without long-lived npm tokens. Protect `main` and require the CI check before merging. Local checks and dry runs do not verify registry trust or package ownership.
- Reference: [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) and [pnpm publish](https://pnpm.io/cli/publish).

## Alchemy release boundary

Alchemy participates in the same `0.1.2` release as every other library under `packages/`.
Its public package retains experimental compatibility limits; inclusion in npm publication does not authorize infrastructure deployment.
First-time publication and Trusted Publisher setup for Alchemy remain package-owner prerequisites.
See [Alchemy integration](../packages/alchemy/docs/INTEGRATION.md).
