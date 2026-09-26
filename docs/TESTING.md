# Test boundaries

Choose checks by the behavior changed: unit and integration tests cover framework contracts, built-host browser tests cover runtime behavior, and the development suite covers HMR.
Unit tests live beside their implementation as `<module>.test.ts` or `<module>.test.tsx`.
Vitest uses its standard discovery patterns; Playwright selects `*.e2e.ts` separately.

## Verification

Run `vp exec --filter "./packages/*" -- vp pack` before checks or tests that resolve package exports.
The check and test tasks do not build dependencies implicitly.

| Check                                                     | Command from the repository root      |
| --------------------------------------------------------- | ------------------------------------- |
| Formatting, lint, and types for source and retained tests | `vp run check`                        |
| Colocated unit tests and retained integration tests       | `vp run test`                         |
| Built Workers fixture through standalone Wrangler         | `(cd tests/e2e-build && vp run test)` |
| Development HMR through Vite/workerd                      | `(cd tests/e2e-dev && vp run test)`   |

Public packages use test-excluding pack entries and dist-only publication.
Package archives must omit unit, integration, and browser tests without changing test discovery.

## Retained integration suites

The built Workers suite exercises its dedicated fixture through the generated Wrangler artifact.
The development suite runs only HMR checks against its own minimal Vite/workerd fixture.
Neither suite imports or modifies the examples or documentation site.

## Independent test ownership

`tests/e2e-build` and `tests/e2e-dev` each own their Playwright dependency, configuration, `webServer`, browser suites, and reports.
Each `fixture/` consumes public package exports.
From either package, `vp run test` runs its browser suite and `vp check` checks its configuration, fixture, and test source.
The root package has no E2E runner script or Playwright dependency.

The Gitignore pattern generator is an external JSR dependency.
Its implementation and CLI tests belong to the [upstream package](https://jsr.io/@totto2727/gitignore-patterns).
Root `vp run check` exercises its integration with VitePlus; do not copy the upstream suite into this repository.

## Standard E2E server lifecycle

The two Workers fixture packages use Playwright's [webServer](https://playwright.dev/docs/test-webserver) for startup, readiness, and shutdown.
Each has one Vite configuration and one fixed command, without a build/dev mode branch or shared multi-host configuration.

| Package           | Host lifecycle                                                   | Port   |
| ----------------- | ---------------------------------------------------------------- | ------ |
| `tests/e2e-build` | `vp build`, then standalone Wrangler with test binding overrides | `4173` |
| `tests/e2e-dev`   | `vp dev` for HMR checks                                          | `4174` |

Both run their fixed `fixture/` directly.
Build output stays under `fixture/dist/`; Playwright reports use the standard `test-results/` directory.
The HMR test restores edited fixture bytes and removes added files in `finally`.
Run each package independently with its own `vp run test` command.
Same-package concurrent execution requires isolation in the execution environment, not additional Playwright configuration.

## Task entry points

Root task definitions live in `vite.config.ts` under `run.tasks`.
`vp run fix`, `vp run check`, and `vp run test` delegate to `js:fix`, `js:check`, and `js:test`.
Their implementation commands are `vp check --fix`, `vp check`, and `vp test run`.
The tasks disable caching so each run checks the current filesystem, including new files.
App-local dev/build and independently owned E2E tasks remain package-local.

## Native Alchemy integration

`tests/e2e-alchemy` exercises the committed `examples/basic` and `examples/loading` consumers without authenticated infrastructure reconciliation or deployment.
Its two Vite configurations reuse the respective application configs and add test-only workerd hosts: Basic has local KV bindings, while Loading has no KV dependency.
Playwright builds both examples and starts separate workerd previews on ports 4393 and 4394 without generating or copying application source.

The browser suite covers:

- Construction-provided native KV clients reaching HTML and Server Functions.
- HEAD handling, hydration, and navigation.
- Emitted Tailwind utility styles and narrow-viewport overflow.
- Loading/Suspense navigation and browser-side Query against Loading's same-host static asset.

Run `vp exec --filter "./packages/*" -- vp pack` at the repository root, then `vp run test` from `tests/e2e-alchemy`.
Application configs leave host injection and infrastructure planning to the official Alchemy CLI.

Core's colocated native HTTP tests cover context precedence, memo-map isolation, and stream finalization independently.
Alchemy's colocated tests cover lazy construction, host-service exclusion, Vite graph composition, temporary runtime projection, and preservation of consumer optimizer settings without registering another host.

## Observed migration results (2026-09-12)

The following results predate the Effront rename and are not current test counts.
Moving the tests preserved their assertions and changed only module-relative imports.

Standard discovery passed all 28 files and 171 tests: 17 colocated suites and 11 retained integration suites.
Formatting, linting, type checking, real Gitignore CLI acceptance, and all nine Workers browser checks passed.
Both package archives were inspected and contained no unit, integration, or browser test files.

## Historical task-interface validation

Validated the real task interface with a temporary source probe: `check` rejected malformed formatting, `fix` repaired it, `check` then passed, and a separate TypeScript mismatch caused `check` to fail before the restored source passed again.
`vp run test` passed all 241 tests across 33 files.
