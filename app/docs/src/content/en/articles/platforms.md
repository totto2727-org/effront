Effront provides adapters for Cloudflare Workers and for Node.js or Bun servers.
Choose the hosting and management model that fits your application.

## Choose your hosting model {#support}

- **Cloudflare Workers managed with Wrangler:** use `@effront/cloudflare` and the [Cloudflare Workers guide](./platforms/cloudflare.md).
- **A Worker and its bindings managed in Alchemy:** use the `@effront/alchemy` adapter and the [Alchemy guide](./platforms/alchemy.md).
- **A server process you start with Node.js or Bun:** use `@effront/server` and the [Node.js / Bun guide](./platforms/node-bun.md).

Wrangler and Alchemy are two ways to manage a Cloudflare Worker, rather than two different deployment environments.

## Set up local development {#architecture}

The platform guides connect an existing Effront application to its host for local development.
They cover package installation, Vite configuration, and the host entry point so you can open a page and check changes in the browser.

## Prepare production startup and assets {#build-startup}

The Wrangler and Node.js / Bun guides also cover production entry points and browser asset delivery, including how to run the built application locally.
Use that setup to check page rendering and browser interactions before deployment.
