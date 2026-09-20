## Choose your hosting model {#support}

| Task                                         | Package               | Setup                                           |
| -------------------------------------------- | --------------------- | ----------------------------------------------- |
| Manage a Cloudflare Worker with Wrangler     | `@effront/cloudflare` | [Cloudflare Workers](./platforms/cloudflare.md) |
| Define a Worker and its resources in Alchemy | `@effront/alchemy`    | [Alchemy](./platforms/alchemy.md)               |
| Start a Node.js or Bun HTTP server           | `@effront/server`     | [Node.js / Bun](./platforms/node-bun.md)        |

Wrangler and Alchemy both target Cloudflare Workers.

## Set up local development {#architecture}

Create your application with [Getting started](./guide/getting-started.md), then follow one setup above.
The Wrangler and Node.js / Bun setups use `vp dev`.
Alchemy uses a `dev` script running `alchemy dev` and requires a configured Cloudflare profile even for local development.

## Prepare production startup and assets {#build-startup}

- [Workers](./platforms/cloudflare.md#local): build, then run Wrangler locally with the generated configuration and browser assets.
- [Node.js / Bun](./platforms/node-bun.md#node): build, then start the emitted server with the matching runtime and asset mounts.

Keep the complete build output when moving either application to its host.
