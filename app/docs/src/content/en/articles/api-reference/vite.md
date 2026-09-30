## effront {#effront}

`effront(options?: EffrontViteOptions): PluginOption[]` from `@effront/vite` configures the application's development and build plugins.
It includes React Compiler, React, and RSC plugins.
Do not register those plugins again.
A host adapter is registered separately:

```typescript
import { effront } from "@effront/vite";
import { effrontCloudflare } from "@effront/cloudflare";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontCloudflare()],
});
```

The application and Wrangler files for this configuration are in [Getting started](/en/guide/getting-started).

## EffrontViteOptions {#configuration}

| Option        | Type     | Default                   | Contract                                                                              |
| ------------- | -------- | ------------------------- | ------------------------------------------------------------------------------------- |
| `application` | `string` | `./src/entry.effront.tsx` | Module default-exporting the application definition, resolved relative to Vite's root |
| `rsc`         | `string` | `./src/entry.workers.ts`  | Request entry exporting `{ fetch }` for the default Workers integration               |

Effront supplies browser startup code.
`application` selects the application definition, not a browser entry.
`@effront/core/application-entry` resolves to that module through a Vite alias, not a standalone public package subpath.
Host adapters such as `effrontServer` and `effrontAlchemy` configure their own request entries.
Effect Schema JIT is registered separately in the browser and SSR entries, the native Node/Bun host, and the RSC entry selected by `effront({ rsc })`.
For native hosting, align the RSC paths with `plugins: [effront({ rsc: "./src/entry.rsc.ts" }), effrontServer()]` so JIT registration targets the actual RSC entry. See the [graph ownership explanation](https://github.com/totto2727-org/effront/blob/main/packages/vite/docs/SCHEMA-JIT.md).

## effrontCloudflare {#cloudflare}

`effrontCloudflare(options?: EffrontCloudflareOptions): PluginOption[]` from `@effront/cloudflare` adds Cloudflare Workers development and build support.
It requires a separate `effront()` registration.

`EffrontCloudflareOptions` accepts `@cloudflare/vite-plugin` options except `viteEnvironment`:

```typescript
import { cloudflare } from "@cloudflare/vite-plugin";

export type EffrontCloudflareOptions = Omit<
  NonNullable<Parameters<typeof cloudflare>[0]>,
  "viteEnvironment"
>;
```

Accepted options are forwarded unchanged, directly rather than under a `cloudflare` property.
Effront fixes `viteEnvironment` to the RSC environment with SSR as its child.
Runtime bindings are read through `@effront/cloudflare/workers`, not this build-time entry.

| Vite setting                    | Default SSR output when no explicit SSR path is set         |
| ------------------------------- | ----------------------------------------------------------- |
| No output overrides             | `dist/rsc/ssr`                                              |
| `build.outDir`                  | `<outDir>/rsc/ssr`                                          |
| `environments.rsc.build.outDir` | `<rsc outDir>/ssr`, taking precedence over the root setting |

An explicit `environments.ssr.build.outDir` takes precedence and is preserved.
The selected path must remain accessible to Wrangler's Worker module bundling.
Use the generated Wrangler configuration for a built Worker.
See [Cloudflare Workers](/en/platforms/cloudflare) for host commands.
