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
| Last fully incorporated upstream baseline | `ed886996d1d3780b94166af4f798c53416d547c8`                                |

Sources: [upstream commit](https://github.com/nikhilsnayak/effective-rsc/commit/ed886996d1d3780b94166af4f798c53416d547c8) and [package manifest at that commit](https://github.com/nikhilsnayak/effective-rsc/blob/ed886996d1d3780b94166af4f798c53416d547c8/packages/effective-rsc/package.json).
The version above is read from the manifest, not an assertion that the commit is a release tag or an exact npm publication.
The parent of this fork's first local implementation commit, `d391de2`, is the recorded baseline, and the upstream history remains in this repository.

## Current Effront mapping

The pinned baseline and comparison material predate the Effront rename. They intentionally retain the original upstream names, source URLs, licenses, paths, commands, and commit hashes.
For current local code, use `packages/core`, package imports `@effront/core/*`, and `Application.effront()`.
The historical combined Cloudflare factory was superseded after the pinned comparison: register `effront()` from `@effront/vite` and `effrontCloudflare()` from `@effront/cloudflare` separately; Cloudflare options are direct adapter options, not nested `cloudflare` options.

## Future incorporation

Keep the original baseline immutable.
When upstream changes are incorporated, record the source commits, corresponding local commits, scope, and validation below.
Advance the last fully incorporated baseline only when the complete change range has been accounted for; a selective cherry-pick does not imply all intervening upstream changes were incorporated.
The Workers/VitePlus runtime intentionally replaces upstream Bun/Rspack behavior, so upstream changes need compatibility review rather than unconditional merging.

| Recorded on | Upstream commit or range                                                               | Local commit                  | Scope and validation                                                                                                                                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-12  | `ed886996d1d3780b94166af4f798c53416d547c8`                                             | Baseline before local changes | Confirmed using the historical package manifest and first local commit's parent.                                                                                                                                                        |
| 2026-09-24  | `1dbdb91bfb8448fc4842f29e63852e326b833e2f`, `6ab7e124cf3e95e6e08889ae7e58c40de70781c0` | `eb91e73a`                    | Adapted omitted input for zero-argument Server Functions and passed the cancellation signal to React's argument encoder. `vp exec --filter "./packages/*" -- vp pack`, `vp run check`, and `vp run test` passed (53 suites, 658 tests). |

The 2026-09-24 update is selective and does not advance the last fully incorporated baseline. Upstream 0.2.0 adds Server Function queries, streamed results, and stream completion handling in `bcd3d255`, `2df9211a`, and `91fa61ea`; those need a coordinated Vite RSC protocol, request-lifetime, and real-host acceptance design before adoption. The upstream React dependency graph, source-map endpoint, Tailwind dependency discovery, Schema JIT imports, Bun/Rspack build changes, release metadata, and docs publishing automation were not copied into Effront's distinct VitePlus/Workers and Node/Bun architecture. The existing `@effront/tailwind` Vite integration remains explicitly application-owned.
