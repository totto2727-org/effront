# Effront examples

Choose a minimal starter by host and infrastructure management. All four starters use byte-identical [`src/entry.effront.tsx`](minimal/node/src/entry.effront.tsx) application code; only host wiring, dependencies, and runtime commands change.

| Host / infrastructure management | Example                                                      | Development  | Production                                  |
| -------------------------------- | ------------------------------------------------------------ | ------------ | ------------------------------------------- |
| Node.js                          | [`minimal/node/`](minimal/node/)                             | `vp dev`     | `vp build && vp run start`                  |
| Bun                              | [`minimal/bun/`](minimal/bun/)                               | `vp dev`     | `vp build && vp run start`                  |
| Cloudflare Workers, standalone   | [`minimal/cloudflare/`](minimal/cloudflare/)                 | `vp dev`     | `vp build`, then deploy the Worker artifact |
| Cloudflare Workers via Alchemy   | [`minimal/alchemy-cloudflare/`](minimal/alchemy-cloudflare/) | `vp run dev` | Alchemy deployment                          |

Run commands in the selected example directory after installing workspace dependencies and packing the Effront packages. The Node and Bun production listeners honor `HOST` and `PORT`. The standalone Cloudflare starter uses Wrangler configuration and local workerd without Alchemy or remote resources; after `vp build`, `vp exec wrangler dev --config dist/rsc/wrangler.json --local` serves the built artifact independently of Vite. The Alchemy starter manages its Worker via Alchemy's local state during development and does not provision remote resources locally.

For framework features and host-specific integrations, use the larger examples instead:

- [`node/`](node/) and [`bun/`](bun/) demonstrate navigation, hydration, Server Functions, and runtime-specific serving. Node also covers loading and Suspense.
- [`alchemy/`](alchemy/) demonstrates an Alchemy-managed Worker with request-local KV-backed services.
- [`markdown/`](markdown/) demonstrates Markdown routing and assets on an Alchemy-managed Worker.
- [`workers/`](workers/) is a feature-rich standalone Cloudflare Workers integration without Alchemy, with bindings and interactive UI rather than the minimal Cloudflare starter.

[`basic/`](basic/) is an alias for the richer `alchemy/` example.
