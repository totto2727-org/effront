# Effect Schema JIT registration

Effront registers Effect's lazy Schema JIT separately in each execution graph.
Importing the enable module in one Vite graph does not initialize the others, and a native Node/Bun host may run outside Vite's transforms.

## Registration points

- **RSC:** `@effront/vite` prepends the side-effect import to the host entry selected by `effront({ rsc })`, defaulting to `src/entry.workers.ts`. The transform runs only for that file in the RSC environment because the application owns its host entry.
- **SSR:** The framework-owned `@effront/core/internal/ssr-entry` (`packages/core/src/server/ssr.tsx`) imports it directly.
- **Browser:** The framework-owned `@effront/core/internal/client-entry` (`packages/core/src/client/entry.ts`) imports it directly.
- **Native Node/Bun host:** `@effront/server/node` and `@effront/server/bun` import it directly so hosting does not depend on Vite's transform.

## Native RSC entry override

`effrontServer()` independently selects the native RSC entry, defaulting to `src/entry.rsc.ts`, while `effront()` still targets its own default `src/entry.workers.ts` for injection.
Consequently, `plugins: [effront(), effrontServer()]` does not prepend the JIT import to the native RSC entry.
Align `effront({ rsc: "./src/entry.rsc.ts" })` with the server adapter's `rsc` option if that Vite graph needs JIT.
The direct Node/Bun host imports do not change this entry-path check.

## Initialization order

The enable import registers a compiler as a module side effect and must run before application schemas are first constructed or their parsers are captured.
Parsers captured earlier remain usable but are not replaced by JIT versions.
The RSC transform therefore prefixes the import to the host entry instead of adding it to an arbitrary application module or relying on another graph's registration.
Applications using matched Effront entries do not need an additional JIT import.
A custom entry or host that bypasses these integration entry points must arrange early registration in each graph it owns.
When dynamic function construction is blocked, Effect retains interpreted parsing.

Source: [Effect 4.0.0-rc.116 `SchemaJITCompiler/enable` documentation and implementation](https://github.com/Effect-TS/effect/blob/effect%404.0.0-rc.116/packages/effect/src/unstable/schema/SchemaJITCompiler/enable.ts).
