# @effront/tailwind development

## Repository structure

- `src/index.ts` owns both the optional stylesheet selection and the generated virtual CSS module.
- `src/index.test.ts` covers directives, query filtering, virtual IDs, and stylesheet paths.

## Development commands

- For a consumer's local-link setup, first follow the [repository preparation commands](../../AGENTS.md#development-commands). The package must have installed dependencies and `dist/` exports before the consumer links it.
- From this package, `vp run pack` regenerates the JavaScript and declarations used by linked consumers after source edits.

## Architecture

- Load CSS through rendered `"use client"` boundaries so RSC includes it in initial HTML and browser hydration. Keep the directive prologue intact.
- Preserve the CSS-shaped absolute virtual module ID and its `effront-tailwind` query so Vite and Tailwind resolve imports from the application root without creating a physical stylesheet.
- Exclude `raw`, `url`, `worker`, and `sharedworker` module requests from client-boundary transformation.
- Resolve the official Tailwind Vite plugin from the application's installed dependencies before Vite plugin collection. Declare both `@tailwindcss/vite` and `tailwindcss` to enable it; neither declared means no injected CSS, and explicit CSS paths still load normally. Explicit CSS paths replace the generated stylesheet and resolve against the Vite root.

## Package-specific rules

- Keep the no-stylesheet Alchemy consumer, explicit Typography stylesheet in the Markdown consumer, and docs theme stylesheet as distinct integration cases.
- Preserve the independent CSS-processing fixtures rather than adding advanced styling scenarios to introductory examples.
- Do not document registry installation as available until the initial package release exists.

## Task-specific documentation

- When checking package changes, use the [shared development commands](../../AGENTS.md#development-commands).
- When changing initial CSS or client-boundary behavior, use [built-artifact acceptance](../../docs/TESTING.md).
- When changing stylesheet or class HMR, use [development acceptance](../../docs/TESTING.md).

_This AGENTS.md was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [AGENTS template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/agents/template.md)._
