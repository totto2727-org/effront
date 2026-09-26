# @effront/tailwind

Style Effront pages with Tailwind CSS, including the initial HTML, without manual CSS imports.

## Usage

Follow the [Styling guide](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/guide/styling) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/guide/styling)) to install the integration, use utilities, customize the theme, and add optional Tailwind plugins.

## Key features

- Load an application stylesheet in the initial HTML and during hydration.
- Integrate Tailwind when the application declares its Vite plugin and CSS packages.

## Prerequisites

Use an Effront application with `@effront/vite` and a host adapter. Tailwind support requires application-owned `tailwindcss` and `@tailwindcss/vite` dependencies.

## Setup

Install and configure the integration using the [Styling setup](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/guide/styling#setup) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/guide/styling#setup)).

## API

The [Tailwind API reference](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/api-reference/tailwind) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/api-reference/tailwind)) covers `effrontTailwind()`, dependency detection, stylesheet selection, and Vite root resolution.

## Development

See [AGENTS.md](AGENTS.md).

## License

[MIT License](LICENSE).

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
