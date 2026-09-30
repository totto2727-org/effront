# Alchemy adapter API

Use the maintained [English Alchemy API reference](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/api-reference/alchemy) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/api-reference/alchemy)) for `ApplicationLoader`, `applicationHttpEffect`, `makeApplicationHttpEffect`, `effrontAlchemy`, their options, and capability-capture and lifetime rules.
Import HTTP helpers from `@effront/alchemy/cloudflare` and the Vite plugin from `@effront/alchemy/cloudflare/vite`.
There is no package-root export.

The [Alchemy Cloudflare guide](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/en/platforms/alchemy) ([日本語](https://effront-docs-docs-production-6rpcuj2cm2urgl4w.totto2727.workers.dev/ja/platforms/alchemy)) shows the minimal host.
For a service backed by KV, use the [Basic example's Worker](../../../examples/basic/src/entry.workers.ts), [stack](../../../examples/basic/alchemy.run.ts), and [application](../../../examples/basic/src/entry.effront.tsx) together.

For runtime compilation and compatibility rationale, see [Integration](INTEGRATION.md).
