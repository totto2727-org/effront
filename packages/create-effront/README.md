# create-effront

Create a minimal Effront React Server Components application for Node.js, Bun, or Alchemy-managed Cloudflare Workers.

## Usage

```sh
pnpm create effront my-app --platform node
cd my-app
pnpm install
pnpm dev
```

Choose `node`, `bun`, or `cloudflare` with `--platform`.
Omit the directory or platform in an interactive terminal to be prompted; specify both in non-interactive environments.
The initializer creates a new directory or uses an existing empty one and never overwrites existing files.

The generated `src/entry.effront.tsx` is identical for all three platforms.
Only the host entry, Vite configuration, scripts, and dependencies differ.

| Platform     | Development                | Production                                |
| ------------ | -------------------------- | ----------------------------------------- |
| `node`       | `pnpm dev`                 | `pnpm build && pnpm start`                |
| `bun`        | `pnpm dev`                 | `pnpm build && pnpm start` (Bun required) |
| `cloudflare` | `pnpm dev` (`alchemy dev`) | Manage through Alchemy                    |

The Cloudflare option uses the native `@effront/alchemy` adapter, not the standalone Cloudflare Vite plugin.
Alchemy's pinned CLI requires a configured Cloudflare profile even for local development; it cannot be used with native Node/Bun hosting.
No deployment is performed by the initializer.

## Prerequisites

- Node.js 24.11 or later for VitePlus development, pnpm, and an npm registry containing the matching Effront `0.1.4` packages.
- Bun 1.4.2 or later for running the Bun production host.
- A configured Cloudflare profile for the Alchemy option.

## Setup

Run `pnpm create effront my-app --platform node` to generate a project with pinned, registry-resolvable dependencies.
Switch the platform argument to `bun` or `cloudflare` for those hosts.
The generated project is independent of this source workspace and does not contain `workspace:` or `catalog:` references.

## API

`pnpm create effront [directory] [--platform node|bun|cloudflare]` creates the project.
`--help` displays the accepted options.

## Development

See [Effront development instructions](../../AGENTS.md).

## License

[MIT](LICENSE).
