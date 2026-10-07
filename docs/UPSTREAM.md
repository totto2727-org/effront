# Upstream baseline

This document records the immutable upstream starting point for future comparisons and selective updates.
It is distinct from the version of this Workers fork.

| Field                                     | Recorded baseline                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| Upstream repository                       | <https://github.com/nikhilsnayak/effective-rsc>                           |
| Upstream package                          | `effective-rsc`                                                           |
| Package manifest version at the baseline  | `0.1.4`                                                                   |
| Baseline commit                           | `ed886996d1d3780b94166af4f798c53416d547c8`                                |
| Commit timestamp                          | `2026-09-10T07:08:42Z`                                                    |
| Commit subject                            | `Merge pull request #30 from nikhilsnayak/chore/update-package-homepages` |
| Last fully incorporated upstream baseline | `d76104aaf3c18cf25191a64bff860a3f6cc08aa0`                                |
| Last incorporated commit timestamp        | `2026-09-19T10:02:00Z`                                                    |
| Last incorporated commit subject          | `Merge pull request #53 from nikhilsnayak/schema/jit`                     |

Sources: [upstream commit](https://github.com/nikhilsnayak/effective-rsc/commit/ed886996d1d3780b94166af4f798c53416d547c8) and [package manifest at that commit](https://github.com/nikhilsnayak/effective-rsc/blob/ed886996d1d3780b94166af4f798c53416d547c8/packages/effective-rsc/package.json).
The version above is read from the manifest, not an assertion that the commit is a release tag or an exact npm publication.
The parent of this fork's first local implementation commit, `d391de2`, is the recorded baseline, and the upstream history remains in this repository.

## Current Effront mapping

The pinned baseline and comparison material predate the Effront rename. They intentionally retain the original upstream names, source URLs, licenses, paths, commands, and commit hashes.
For current local code, use `packages/core`, package imports `@effront/core/*`, and `Application.effront()`.
The historical combined Cloudflare factory was superseded after the pinned comparison: register `effront()` from `@effront/vite` and `effrontCloudflare()` from `@effront/cloudflare` separately. Cloudflare options are direct adapter options, not nested `cloudflare` options.

## Stable Effect v4 dependency policy

The upstream comparison baseline remains `d76104aaf3c18cf25191a64bff860a3f6cc08aa0`.
Effront uses stable Effect v4 packages through the shared `^4.0.1` catalog range instead of the former exact `4.0.0-rc.116` pins.
All eight public packages, including `create-effront`, advance together from 0.2.0 to 0.3.0 for this compatibility change.
Generated starter dependencies and maintained installation guides target the same release.

The subsequent 0.3.1 patch synchronizes all eight packages, generated starters, and maintained installation guides.
It selects mature Vite Plus 1.0.0 without new release-age exclusions.
Consumer installation examples now use unversioned package names.
Compatibility guidance refers to the installed packages' peer metadata instead of duplicating the release catalog.
This documentation policy leaves manifest ranges, generated starter dependencies, lockfile resolution, and runtime source unchanged.

The stable Effect v4 compatibility change affects public dependency and peer ranges, workspace overrides, and the `create-effront` templates.
The range allows v4 minor and patch updates but excludes prereleases and v5.
The lockfile records concrete versions for reproducible installation, and consumers must retain one coherent Effect installation across the host and application graphs.

`@effect/vitest@4.0.1` requires Vitest 5, so VitePlus and its Vite alias use `^1.0.0` with Vitest `^5.0.1`.
Package task inputs and outputs remain under `cache` for VitePlus 1's task schema.
The lockfile selects VitePlus and its core alias at 1.0.0 and Vitest at 5.0.1.
This preserves the package manager's default minimum release age instead of admitting the newly published VitePlus 1.1.0 through exclusions.
For compatible future updates, select the latest mature release without lowering the threshold or automatically adding exceptions.

The initializer templates use the same VitePlus range, allowing compatible minor and patch updates without admitting the next major.
This is a test-tool compatibility update, not a runtime redesign.
The Nix environment uses the current `nix-vite-plus` overlay revision `af16f6183aec0717d8975ee858c910ab43babee6`, which supplies the VitePlus 1.0.0 launcher.
Repository-local tooling also resolves to 1.0.0 through the catalog and lockfile.

Stable Effect v4 promotes `effect/unstable/*` to public paths such as `effect/http`, `effect/cli`, `effect/schema`, and `effect/reactivity`.
Runtime imports, JIT-generated imports, test fixtures, and maintained guides use those paths.
Alchemy and its Cloudflare runtime use beta.81 because beta.79 still imports the removed paths despite peer ranges admitting stable v4.

When an application response omits status text, the Vite host supplies standard status text.
Otherwise, Effect's native three-argument `writeHead` loses response headers inside Vite preview's compression middleware.
This causes incorrect decoding of non-ASCII HTML.
The native host browser suite checks response headers and the document charset. Custom status text and streaming bodies remain intact.
Static assets follow stable Effect's `If-Range` handling: only matching strong ETags permit a range, while stale/weak validators and dates produce the full response.

No upstream runtime source is incorporated by this change. External consumer repositories remain unchanged.
Published contracts: [Effect 4.0.1](https://registry.npmjs.org/effect/4.0.1), [Effect Vitest 4.0.1](https://registry.npmjs.org/@effect%2fvitest/4.0.1), [VitePlus 1.0.0](https://registry.npmjs.org/vite-plus/1.0.0), and [Alchemy beta.81](https://registry.npmjs.org/alchemy/2.0.0-beta.81).

## Future incorporation

Keep the historical baseline immutable as the comparison point, and advance the last fully incorporated baseline whenever a reviewed upstream range is fully accounted for.

When you incorporate upstream changes, add one row per adopted upstream feature.
Give the local commits that deliver it.
Give the reason that the Effront implementation differs from upstream.
Record the reason for every intentional divergence. An undocumented divergence is treated as an untracked risk, so extend this document in the same change that adopts upstream behavior.

Keep the existing Effront implementation whenever it already satisfies the upstream feature: adopt the behavior, not the upstream code. Upstream carries a different build tool, runtime, and deployment target, so import only the parts that are essentially required, and record everything else as a divergence instead of copying it.

Account for every commit in the range, not only the adopted ones.
For full range accounting, record each commit as an adopted feature or as deliberately deferred with a reason.
Then advance the baseline to the last reviewed commit. A selective cherry-pick without that accounting does not imply the intervening upstream changes were incorporated.
The Workers/VitePlus runtime intentionally replaces upstream Bun/Rspack behavior, so upstream changes need compatibility review rather than unconditional merging.

## Incorporated range

On 2026-09-27 the last fully incorporated baseline advanced from `ed886996d1d3780b94166af4f798c53416d547c8` (2026-09-10) to `d76104aaf3c18cf25191a64bff860a3f6cc08aa0` (2026-09-19), covering the [0.2.0](https://github.com/nikhilsnayak/effective-rsc/releases/tag/v0.2.0) release and the six commits that followed it.
The range was enumerated with the upstream compare API rather than inferred: `ed886996...0b5cb20a` contains 34 commits and `0b5cb20a...d76104aa` contains six.
The accounting table below gives an explicit disposition for every commit in those ranges.
[Adopted upstream features](#adopted-upstream-features) gives the feature-level details.
[Deferred upstream commits](#deferred-upstream-commits) gives the reasons to omit the rest.

The historical baseline `ed886996d1d3780b94166af4f798c53416d547c8` remains the immutable comparison point for the architecture excerpts and earlier provenance records.
The record dates from 2026-09-12 and uses the historical package manifest and the first local commit's parent.

### Range accounting

| Upstream commits                                        | Disposition                                                                                               |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `0006bbca`, `a248942a`, `635d2453`, `f230fd5f` (PR #31) | Deferred, Rspack asset compilation.                                                                       |
| `ccb00df0`, `9be750c8` (PR #32)                         | Deferred, upstream test infrastructure.                                                                   |
| `7ca83cb1`, `e6bbe8df` (PR #33)                         | Deferred, Rspack React runtime graphs.                                                                    |
| `80bc27ec`, `f6ad8e51` (PR #37)                         | Adopted, Atom registry in the application root.                                                           |
| `bcd3d255`, `d9804ba6` (PR #34)                         | Adopted, interruptible queries.                                                                           |
| `2df9211a`, `f885a3e2` (PR #35)                         | Adopted, request-owned streams.                                                                           |
| `428fcd41`, `aa033b75` (PR #36)                         | Adopted, check-in sample.                                                                                 |
| `8d22d8cc`, `3676c079` (PR #38)                         | Partially adopted, bilingual guides for the adopted behavior.                                             |
| `7dd34437`, `becd336e`, `61779f7c` (PR #40)             | Deferred, release-docs pipeline.                                                                          |
| `1dbdb91b`, `4adf45c1` (PR #41)                         | Adopted, zero-argument Server Function input.                                                             |
| `91fa61ea`                                              | Adopted, full Flight completion for streams.                                                              |
| `355d0b1f`, `c1a47148` (PR #43)                         | Adopted, streaming-feed example.                                                                          |
| `d9bdcf7c`, `ca4204a9` (PR #45)                         | Deferred, Vercel packaging.                                                                               |
| `6ab7e124`, `925156a0` (PR #46)                         | Adopted, cancellation and Vite source-map verification.                                                   |
| `c3dc57ab`, `bfe9cb5c` (PR #47)                         | Adopted, streaming-feed query retry.                                                                      |
| `341473a9`, `0b5cb20a` (PR #48)                         | Deferred as code, upstream 0.2.0 release preparation. `0b5cb20a` bounds the release portion of the range. |
| `a98ee362`                                              | Deferred, upstream documentation publication.                                                             |
| `d8fad159`                                              | Adopted as Effront's own dependency pins.                                                                 |
| `d8abb492`                                              | Deferred, upstream contributor documentation restructure.                                                 |
| `fdd8c135`                                              | Deferred, dependency-driven Tailwind configuration. The adapter-owned implementation is kept.             |
| `cb3ce5d8`, `d76104aa` (PR #53)                         | Adopted, per-graph Schema JIT registration. `d76104aa` bounds the range.                                  |

## Adopted upstream features

| Recorded on | Upstream commits                   | Upstream feature                                                              | Local commits                      | Effront behavior and the reason it differs from upstream                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------- | ---------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-24  | `1dbdb91b`                         | Omitted input for zero-argument Server Functions                              | `eb91e73a`                         | Adopted: an omitted argument is accepted and extra arguments are rejected, with type tests. No protocol divergence. The call still travels through Effront's own `ServerFn` wiring.                                                                                                                                                                                                                                                                                                   |
| 2026-09-24  | `6ab7e124`                         | Flight argument-encoding cancellation and development source maps             | `eb91e73a`, `b5c77cef`             | Adopted the abort signal passed into React's argument encoder and confirmed Vite's existing RSC source-map endpoint against a real HTTP server. Divergence: Rspack's development file-server route is not copied, because Vite's RSC plugin already serves source maps.                                                                                                                                                                                                               |
| 2026-09-24  | `bcd3d255`                         | Interruptible Server Function queries with framework errors                   | `90331dc4`, `daa7ce85`, `1349eb03` | Adopted typed failures and interruption, including waiting for the full Flight response before a value query settles. Divergence: queries are exposed through `@effront/core/query` and a separate `POST /_effront/query` transport instead of upstream's client transport.                                                                                                                                                                                                           |
| 2026-09-24  | `2df9211a`, `91fa61ea`             | Stream Server Functions with request-owned cleanup                            | `11c81d1f`, `ef2aeaf8`, `daa7ce85` | Adopted producer ownership inside the request scope and completion of the full Flight response before the stream finishes. Divergence: the request Scope is owned by the Effront host and stays live until the response completes, fails, or is cancelled, so upstream's application-startup lifetime explanation is not reused.                                                                                                                                                      |
| 2026-09-24  | `355d0b1f`, `c3dc57ab`             | Streamed Server Component feed example and query retry                        | `d99af874`                         | Re-implemented as an Alchemy-managed Worker showcase with incremental chunks, note queries, retry, cancellation, and client-state retention. Divergence: it uses Vite and a local Worker test harness rather than upstream Bun/Rspack or Vercel packaging. Its consumer uses `stream` to retain every arrived item because `streamAtom` by itself exposes only the latest result, and per-card `queryAtom` would need separate atom instances without improving this demo's behavior. |
| 2026-09-24  | `80bc27ec`, `428fcd41`             | Atom registry owned by the application root, check-in preview through queries | `b90ae611`, `e62fe140`             | Adopted the official Atom React registry inside the sample's single-page Client Component, organizer scoping, idempotent audit, and Worker browser acceptance. Divergence: the Alchemy-managed Worker fixes a demo actor and keeps a Worker-instance-local store. Upstream's Bun SQLite event platform is not copied, and this is neither authentication nor a durable database.                                                                                                      |
| 2026-09-24  | `cb3ce5d8`                         | Effect Schema JIT compilation in every graph                                  | `ba4b5577`, `f9942315`             | Adopted early registration in each execution graph. Divergence: registration targets Vite's RSC, SSR, and browser entries, the RSC entry must be the same path passed to `effront({ rsc })` and `effrontServer({ rsc })`, and a CSP that blocks dynamic code generation falls back to the interpreter. Upstream registers inside its own Rspack build.                                                                                                                                |
| 2026-09-26  | `d8fad159`                         | Effect, React, and workspace tooling upgrade                                  | `0d31983b`, `84040444`, `f8587bb4` | Adopted as Effront's own catalog pins (Effect rc.116, Alchemy beta.79, Atom React) rather than upstream's exact set, and verified the native host's Range and HEAD behavior against the upgraded Effect. Divergence: one catalog covers the whole workspace, so the later `packages/create-effront` Effect CLI work had to be ported to the rc.116 `effect/unstable/cli` names when main was merged.                                                                                  |
| 2026-09-26  | `8d22d8cc`, `a98ee362`, `d8abb492` | Public guide and reference documentation                                      | `1c91fbe9`, `f9942315`, `8e603d0a` | Adopted the content that documents the adopted behavior, in Japanese and English. Divergence: Effront keeps package README files as short routing documents and the bilingual `app/docs` site as the canonical public contract, Markdown guide ownership is tracked separately, and upstream's documentation pipeline and release-docs promotion are not used.                                                                                                                        |

## Deferred upstream commits

| Upstream commits                               | Reason                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `0006bbca`, `a248942a`, `635d2453`, `f230fd5f` | Rspack asset compilation and its decision records. Vite already compiles imported assets for every supported host, so copying the Rspack resolver would duplicate an existing graph.                                                                                                                                                                                                                   |
| `ccb00df0`, `9be750c8`                         | Vitest filesystem module cache tuning for the upstream build. It configures test infrastructure that Effront does not use.                                                                                                                                                                                                                                                                             |
| `7ca83cb1`, `e6bbe8df`                         | React dependency resolution through upstream runtime graphs. Vite and Rolldown own that resolution, and the separate RSC, SSR, and browser graphs are already explicit.                                                                                                                                                                                                                                |
| `7dd34437`, `becd336e`, `61779f7c`             | Upstream documentation promotion and release-docs pipeline. Effront publishes its own bilingual site and does not pin released docs from the package.                                                                                                                                                                                                                                                  |
| `d9bdcf7c`, `ca4204a9`                         | Vercel packaging for the streaming feed, together with the Vite-native Build Output adapter that was added locally as `726ea05c` and removed in `7706fdaf`. Local artifact tests passed, but hosted deployment, platform routing and limits, and disconnect propagation remain unauthorized and unverified, so the roadmap keeps Vercel deferred.                                                      |
| `341473a9`                                     | Upstream 0.2.0 release preparation. Effront has its own release policy, versioning, and publication workflow.                                                                                                                                                                                                                                                                                          |
| `a98ee362`                                     | Upstream documentation publication for the released package. Effront documents the adopted behavior in its own bilingual site instead of pinning released docs from the package.                                                                                                                                                                                                                       |
| `d8abb492`                                     | Upstream contributor and package documentation restructure. Effront owns a different repository layout, package README policy, and documentation index.                                                                                                                                                                                                                                                |
| `fdd8c135`                                     | Tailwind configured from the application's declared dependencies. Effront keeps the adapter-owned implementation: the adapter ships `@tailwindcss/vite` and `tailwindcss` and always includes the plugin, so delegated conditional injection removed the styles that the `tests/e2e-server` fixtures receive through that dependency. The attempted adoption was reverted before the baseline advance. |

Local-only commits in the same range (`19eb7087`, `4e0c982c`, `3e2e5ecc`, `f9942315`, `f8587bb4`, and the merge commits `cdefb834` and `54dcd2b8`) record provenance, lock the check-in sample's CI dependency, resolve merges with `main`, and port the Effect CLI. They have no upstream counterpart.

## Re-evaluated compatibility boundaries

Compatibility code that only existed for an older dependency pin is removed once the pinned release provides the behavior, rather than kept as an unverified fallback.
Each removal is recorded here with the evidence that replaced the guard.

| Boundary                                                 | Origin                                                                                                                                           | Outcome                                                                                                                                                                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `effrontTailwind` dependency-driven option surface       | An attempted adoption of `fdd8c135`, which resolved the application's declared Tailwind packages, added a `root` option, and returned a Promise. | Reverted: the feature is deferred, so `packages/tailwind` keeps the adapter-owned implementation with a plain `PluginOption[]` return and no `root` option.                                                                 |
| Guarded Fetch response URL accessor in `@effront/core`   | The rc.112 pin had no public final-response URL.                                                                                                 | Removed: rc.116 exposes `HttpClientResponse.url`, so the Flight client reads it directly. The accessor contract stays covered by `packages/core/tests/client/effect-response-url.test.ts`.                                  |
| HEAD response body normalization in `@effront/core/http` | The rc.112 pin could transfer a streaming scope before a discarded HEAD body.                                                                    | Removed: the pinned Web handler and the native Node and Bun hosts release the request scope for HEAD while preserving streamed GET metadata, verified through the core handler regression tests and a real Node host check. |
