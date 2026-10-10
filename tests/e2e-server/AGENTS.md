# Native server browser integration

## Development commands

Bootstrap workspace packages first with root `vp exec --filter "./packages/*" -- vp pack`.
Make Node and Playwright Chromium available.
Then run `vp run test` in this directory.
This workspace package supplies the pinned Bun 1.4.2 test binary.
pnpm installs that catalog-managed binary only for genuine Bun production-host acceptance, not dependency management.

The suite owns ports 4451, 4452, 4453 and 4454 and starts production Node/Bun fixtures plus Node-hosted Vite development and preview.
Preview uses the Node fixture output built by the first web server.
Preserve that startup ordering.
Do not run another build against those fixture outputs while this suite is active.

## Architecture

- Exercise the committed fixture application entries and actual standard Effect HTTP listeners, not a copied handler or test-only host.
- Check SSR and HEAD, hydration, Server Functions, navigation, no-JavaScript styles, public files, and production asset isolation.
- Keep lower-level request scope, cancellation and filesystem security cases in the owning server package tests.
- Vite development is Node transport even for Bun applications. Production Bun is a separate required project, not a skipped optional smoke test.

_This AGENTS.md was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [AGENTS template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/agents/template.md)._
