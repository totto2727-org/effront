# Effront examples

Choose a minimal starter by deployment platform. All three starters use identical [`src/entry.effront.tsx`](hello-world/src/entry.effront.tsx) application code, with only the host wiring, dependencies, and runtime commands changing.

| Platform                       | Example                                              | Development  | Production                 |
| ------------------------------ | ---------------------------------------------------- | ------------ | -------------------------- |
| Node.js                        | [`hello-world/`](hello-world/)                       | `vp dev`     | `vp build && vp run start` |
| Bun                            | [`hello-world-bun/`](hello-world-bun/)               | `vp dev`     | `vp build && vp run start` |
| Cloudflare Workers via Alchemy | [`hello-world-cloudflare/`](hello-world-cloudflare/) | `vp run dev` | Alchemy deployment         |

Run commands in the selected example directory after installing workspace dependencies and packing the Effront packages. The Node and Bun production listeners honor `HOST` and `PORT`. The Cloudflare starter uses Alchemy's local state and does not provision remote resources for local development.

For framework features and host-specific integrations, use the larger examples instead:

- [`node/`](node/) and [`bun/`](bun/) demonstrate navigation, hydration, Server Functions, and runtime-specific serving. Node also covers loading and Suspense.
- [`alchemy/`](alchemy/) demonstrates an Alchemy-managed Worker with request-local KV-backed services.
- [`markdown/`](markdown/) demonstrates Markdown routing and assets on an Alchemy-managed Worker.
- [`workers/`](workers/) is an intentionally standalone Cloudflare Workers integration without Alchemy. It remains a separate regression consumer, not the Cloudflare platform starter.

[`basic/`](basic/) is an alias for the richer `alchemy/` example.
