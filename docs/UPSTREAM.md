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

| Recorded on | Upstream commit or range                                                               | Local commit                                   | Scope and validation                                                                                                                                                                                                                                                               |
| ----------- | -------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-12  | `ed886996d1d3780b94166af4f798c53416d547c8`                                             | Baseline before local changes                  | Confirmed using the historical package manifest and first local commit's parent.                                                                                                                                                                                                   |
| 2026-09-24  | `1dbdb91bfb8448fc4842f29e63852e326b833e2f`, `6ab7e124cf3e95e6e08889ae7e58c40de70781c0` | `eb91e73a`                                     | Adapted omitted input for zero-argument Server Functions and passed the cancellation signal to React's argument encoder. The original checks passed 53 suites and 658 tests.                                                                                                       |
| 2026-09-24  | `6ab7e124cf3e95e6e08889ae7e58c40de70781c0`                                             | `b5c77cef`                                     | Confirmed Vite's existing RSC development source-map endpoint using an actual HTTP server and two regression tests, rather than copying Rspack's file-server route.                                                                                                                |
| 2026-09-24  | `bcd3d255`, `2df9211a`, `91fa61ea`                                                     | `90331dc4`, `11c81d1f`, `ef2aeaf8`, `daa7ce85` | Adapted interruptible, typed-error Query and request-scoped Stream Server Functions to the Vite Flight protocol. Core passed 276 tests, and the Node streaming-feed example passed ten browser scenarios across development and production.                                        |
| 2026-09-24  | `355d0b1f`, `c3dc57ab`                                                                 | `d99af874`                                     | Added a Node streaming-feed showcase for incremental chunks, note queries, retry, cancellation, and client-state retention, with development and production browser coverage.                                                                                                      |
| 2026-09-24  | `fdd8c135`, `cb3ce5d8`, `d8fad159`                                                     | `ba4b5577`, `0d31983b`                         | Enabled schema JIT across Vite graphs, selected the application's optional Tailwind dependencies, and aligned Effect rc.116, Alchemy beta.79, and Atom React. Workers (35) and Alchemy (3) browser checks passed. The Effect compiler falls back under a blocked dynamic-code CSP. |
| 2026-09-24  | `d9bdcf7c`                                                                             | `726ea05c`                                     | Added a Vite-native Node.js 22 Vercel Build Output adapter with local generated-function HTTP and static-asset tests. Hosted deployment remains unverified.                                                                                                                        |

The 2026-09-24 work adapts upstream [0.2.0](https://github.com/nikhilsnayak/effective-rsc/releases/tag/v0.2.0) and later commits selectively without changing the last fully incorporated baseline. The source-map route and React dependency graph in the upstream Rspack build are not copied verbatim: Vite's RSC plugin already supplies a source-map endpoint and separate React runtime environments, and these are exercised by Vite and real-host tests. Upstream's Bun/Rspack build, release automation, and application-startup lifetime assumptions are not Effront runtime contracts. The Vercel adapter packages Vite output instead, while its hosted deployment still requires authorization and platform validation.
