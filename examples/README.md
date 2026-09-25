# Effront examples

Choose a minimal starter by host and infrastructure management. All four starters use byte-identical [`src/entry.effront.tsx`](node/src/entry.effront.tsx) application code; only host wiring, dependencies, and runtime commands change.

| Host / infrastructure management | Example                                      | Development  | Production                                  |
| -------------------------------- | -------------------------------------------- | ------------ | ------------------------------------------- |
| Node.js                          | [`node/`](node/)                             | `vp dev`     | `vp build && vp run start`                  |
| Bun                              | [`bun/`](bun/)                               | `vp dev`     | `vp build && vp run start`                  |
| Cloudflare Workers, standalone   | [`cloudflare/`](cloudflare/)                 | `vp dev`     | `vp build`, then deploy the Worker artifact |
| Cloudflare Workers via Alchemy   | [`alchemy-cloudflare/`](alchemy-cloudflare/) | `vp run dev` | Alchemy deployment                          |

Run commands in the selected example directory after installing workspace dependencies and packing the Effront packages. The Node and Bun production listeners honor `HOST` and `PORT`. The standalone Cloudflare starter uses Wrangler configuration and local workerd without Alchemy or remote resources; after `vp build`, `vp exec wrangler dev --config dist/rsc/wrangler.json --local` serves the built artifact independently of Vite. The Alchemy starter manages its Worker via Alchemy's local state during development and does not provision remote resources locally. Vite chooses an available development port for each starter.

For framework features and host-specific integrations, use the larger examples instead:

- [`basic/`](basic/) demonstrates an Alchemy-managed Worker with request-local KV-backed services.
- [`markdown/`](markdown/) demonstrates Markdown routing and assets on an Alchemy-managed Worker.

The native Node and Bun regression applications live under [`../tests/e2e-server/fixtures/`](../tests/e2e-server/fixtures/), not in the public examples.
