# @effront/vite development

## Repository structure

- `src/index.ts` owns the React/RSC plugins, application-entry alias, and raw-import HMR handling.
- `src/browser.ts` is the supplied browser entry, not an additional public package subpath.

## Architecture

- Keep the portable compiler integration separate from host registration. The host adapter supplies the runtime, and `serverHandler: false` prevents this package from installing another HTTP handler.
- Keep `@effront/core/internal/*` as a version-matched integration contract rather than an application API.
- Raw-import HMR must retain actual `?raw` modules while filtering queryless watch nodes. Deleting a raw file must invalidate live importers so native glob discovery updates.

## Task-specific documentation

- When changing plugin composition or entry resolution, inspect `src/index.test.ts` and use the [shared development commands](../../AGENTS.md#development-commands).
- When changing generated Workers behavior, use [built-artifact acceptance](../../docs/TESTING.md).
- When changing raw imports or HMR, use [development acceptance](../../docs/TESTING.md).
- When considering new hosts, consult the [adapter roadmap](../../docs/ROADMAP.md#server-runtime-adapters).

_This AGENTS.md was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [AGENTS template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/agents/template.md)._
