Use `@effront/vite` to add Effront to your Vite configuration, then add the adapter for the host that will run your application.
For Cloudflare Workers, the adapter is `@effront/cloudflare`.
Start with the default registration below, and set options only when you need different entry files or Cloudflare settings.

## Enable Effront in Vite {#effront}

`effront(options?: EffrontViteOptions): PluginOption[]` supplies Effront's development and build plugins.
Register its result in Vite's `plugins` array alongside your host adapter.
This is the default configuration for Cloudflare Workers:

```typescript
import { defineConfig } from "vite-plus";
import { effront } from "@effront/vite";
import { effrontCloudflare } from "@effront/cloudflare";

export default defineConfig({
  plugins: [effront(), effrontCloudflare()],
});
```

`effront()` enables React Compiler and includes the React and RSC plugins.
Do not add another registration of those plugins to this configuration.
For the application files and Wrangler configuration needed to run this example, follow [Getting started](/en/guide/getting-started).

## Choose entry files {#configuration}

The two `effront()` options let you choose the files that define your application and handle incoming requests.
They are optional when you use the default file layout.

```typescript
export type EffrontViteOptions = {
  readonly rsc?: string;
  readonly application?: string;
};
```

| Option        | Default                   | Purpose                                                                                                      |
| ------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `application` | `./src/entry.effront.tsx` | Selects the module that exports your application definition. The path is resolved relative to Vite's `root`. |
| `rsc`         | `./src/entry.workers.ts`  | Selects the request-handling entry that exports a `{ fetch }` handler.                                       |

For example, the following spells out both defaults.
Replace the paths if you move or rename these files:

```typescript
import { defineConfig } from "vite-plus";
import { effront } from "@effront/vite";
import { effrontCloudflare } from "@effront/cloudflare";

export default defineConfig({
  plugins: [
    effront({
      rsc: "./src/entry.workers.ts",
      application: "./src/entry.effront.tsx",
    }),
    effrontCloudflare(),
  ],
});
```

The `application` option points to your application definition, not a browser entry.
Effront supplies browser startup code itself.
Imports of `@effront/core/application-entry` resolve through a Vite alias to your selected application module.
This alias is not a standalone public subpath of `@effront/core`.

## Configure Cloudflare Workers {#cloudflare}

`effrontCloudflare(options?: EffrontCloudflareOptions): PluginOption[]` supplies the Workers-specific plugins used with `effront()`.
Pass Cloudflare Vite plugin options directly to this function, rather than wrapping them in a `cloudflare` property.
The accepted type is:

```typescript
import { cloudflare } from "@cloudflare/vite-plugin";

export type EffrontCloudflareOptions = Omit<
  NonNullable<Parameters<typeof cloudflare>[0]>,
  "viteEnvironment"
>;
```

All accepted options are forwarded unchanged to `@cloudflare/vite-plugin`.
`viteEnvironment` is excluded because Effront sets it for you.
For runtime access to `env`, use `@effront/cloudflare/workers` instead of this build-time entry.

**Output directories**

Keep the default output layout unless you need to change where build artifacts are written.
By default, SSR modules are written to `dist/rsc/ssr`, where Wrangler can include them in the Worker.
To change output paths, use Vite settings rather than `effrontCloudflare()` options:

| Vite setting                    | Result when no explicit SSR output path is set                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `build.outDir`                  | SSR output goes into `rsc/ssr` beneath this directory, unless `environments.rsc.build.outDir` is also set. |
| `environments.rsc.build.outDir` | SSR output goes into `ssr` beneath this directory.                                                         |

Setting `environments.ssr.build.outDir` explicitly takes precedence over both rules.
Effront preserves that value, so you must ensure Wrangler can still include the SSR modules at the new location.
When running a build locally, use its generated Wrangler configuration.
See [Cloudflare Workers](/en/platforms/cloudflare) for the development and production commands.
