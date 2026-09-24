# create-effront

Create a minimal Effront React Server Components application for Node.js, Bun, standalone Cloudflare Workers, or Alchemy-managed Cloudflare Workers.

## Usage

```sh
vp create effront -- my-app --platform node
cd my-app
vp install
vp dev
```

Pass the directory and `--platform` after `--` so VitePlus forwards them to the generator; choose `node`, `bun`, `cloudflare`, or `alchemy-cloudflare`.
Omit the directory or platform in an interactive terminal to be prompted; specify both in non-interactive environments.
The initializer creates a new directory or uses an existing empty one and never overwrites existing files.

The generated `src/entry.effront.tsx` is identical for all four platforms.
Only the host entry, Vite configuration, scripts, and dependencies differ.

| Platform             | Development              | Production                                |
| -------------------- | ------------------------ | ----------------------------------------- |
| `node`               | `vp dev`                 | `vp build && vp run start`                |
| `bun`                | `vp dev`                 | `vp build && vp run start` (Bun required) |
| `cloudflare`         | `vp dev`                 | `vp build && vp run deploy`               |
| `alchemy-cloudflare` | `vp dev` (`alchemy dev`) | Manage through Alchemy                    |

The `cloudflare` option uses `@effront/cloudflare` and Wrangler without Alchemy; local development runs in workerd without Cloudflare credentials.
The `alchemy-cloudflare` option uses the native `@effront/alchemy` adapter; its pinned CLI requires a configured Cloudflare profile even for local development.
No deployment is performed by the initializer.

## Prerequisites

- Node.js 24.11 or later for VitePlus development and an npm registry containing the matching Effront `0.1.4` packages.
- Bun 1.4.2 or later for running the Bun production host.
- A configured Cloudflare profile for `alchemy-cloudflare` development or Cloudflare deployment.

## Setup

Run `vp create effront -- my-app --platform node` to generate a project with pinned, registry-resolvable dependencies.
Switch the platform argument to `bun`, `cloudflare`, or `alchemy-cloudflare` for those hosts.
The generated project is independent of this source workspace and does not contain `workspace:` or `catalog:` references.

## API

`vp create effront -- [directory] --platform node|bun|cloudflare|alchemy-cloudflare` creates the project.
`--help` displays the accepted options.

## Development

See [Effront development instructions](../../AGENTS.md).

## License

[MIT](LICENSE).
