# Alchemy adapter API

Use the maintained [English Alchemy API reference](https://effront.totto2727.dev/en/api-reference/alchemy) ([日本語](https://effront.totto2727.dev/ja/api-reference/alchemy)) for `ApplicationLoader`, `applicationHttpEffect`, `makeApplicationHttpEffect`, `effrontAlchemy`, their options, and capability-capture and lifetime rules.
Import HTTP helpers from `@effront/alchemy/cloudflare` and the Vite plugin from `@effront/alchemy/cloudflare/vite`.
Import the no-argument `makeApplicationHttpEffect<Definition>()` from `@effront/alchemy/cloudflare/application` instead of the explicit-loader entry.
`ApplicationLoader` is a native application-source Effect, executed per request.
Use `Effect.succeed(application)` for a static definition in a dedicated RSC entry.
Source errors remain typed and source requirements follow the same live-context contract as application requirements.
`applicationHttpEffect(source)` uses ordinary Effect dependency provisioning and has no context option.
Only `makeApplicationHttpEffect` captures construction-time service references, with live request services taking precedence.
There is no callback overload or package-root export.

The [Alchemy Cloudflare guide](https://effront.totto2727.dev/en/platforms/alchemy) ([日本語](https://effront.totto2727.dev/ja/platforms/alchemy)) shows the minimal host.
For a service backed by KV, use the [Basic example's Worker](../../../examples/basic/src/entry.workers.ts), [stack](../../../examples/basic/alchemy.run.ts), and [application](../../../examples/basic/src/entry.effront.tsx) together.

For runtime compilation and compatibility rationale, see [Integration](INTEGRATION.md).
