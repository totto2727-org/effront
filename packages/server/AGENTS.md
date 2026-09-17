# Effront server

## Repository structure

- `src/node.ts` and `src/bun.ts` compose the matching native HTTP Layer; keep their import graphs isolated.
- `src/assets.ts` owns host-independent file resolution and HTTP metadata policy.
- `src/vite.ts` owns Node-compatible dev/preview middleware and production RSC entry configuration.

## Development commands

From the repository root, install dependencies and bootstrap packages with `vp exec --filter "./packages/*" -- vp pack`.
Run `vp test run packages/server/src` for native transport/assets and Vite regression tests.
Run `vp run test` inside `tests/e2e-server` for the real Node/Bun production and Vite development browser workflows; Node and Playwright Chromium must be installed; the E2E package provides pinned Bun 1.4.2.
Run `vp pack` in this package after changing public declarations.

## Architecture

- Keep standard `HttpServer.serve`, matching platform Layers, and caller-owned `Layer.launch`/`runMain`. Do not introduce Fetch wrappers or independently managed listeners.
- Vite already owns a listener. Use `NodeHttpServer.makeHandler`, never `NodeHttpServer.layerServer` with Vite's HTTP server.
- Resolve the RSC entry on each dev request so Vite owns invalidation. Close the runtime on server shutdown and middleware-mode plugin disposal.
- Keep React server conditions inside the RSC graph, never process-wide.
- Resolve asset roots at construction and real paths before serving. HEAD/304 must not acquire a file stream. Application requests preserve their external Effect service requirements.
- Bun disables the default short idle timeout to preserve long-lived RSC streams. Keep the 10 MiB host limit consistent with core's request policy.

## Package-specific rules

- There is no root export that eagerly imports both runtime adapters.
- Runtime platform peers are optional because consumers choose one host. `/vite` always needs the Node platform, including Bun applications.
- Use only trusted build/public roots. Do not add directory indexes or an HTML fallback under a static asset prefix.

## Task-specific documentation

- For consumer options and static HTTP behavior: [package API](README.md#api).
- For end-to-end runtime coverage: [native server tests](../../tests/e2e-server/AGENTS.md).

_This AGENTS.md was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [AGENTS template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/agents/template.md)._
