# Core development

## Repository structure

- `src/application/` owns the shared identity, authoring factories, route graph, and request rendering contracts.
- `src/http.ts` owns the native Effect HTTP boundary; `src/workers.ts` owns the compatibility Web Fetch boundary and host context.
- `src/rsc/`, `src/server/`, and `src/client/` separate Flight production, HTML rendering, and browser navigation.
- `tests/` retains cross-module and tool-boundary contracts.

## Development commands

After the [repository build prerequisites](../../AGENTS.md#development-commands), run `vp test run packages/core` from the repository root for core unit and integration contracts.
Use the independent [built Fetch acceptance](../../docs/TESTING.md#independent-test-ownership), [development HMR acceptance](../../docs/TESTING.md#independent-test-ownership), or [native Alchemy acceptance](../../docs/TESTING.md#native-alchemy-integration) when the changed runtime boundary requires it.

The retained suites under `tests/` have these package-owned responsibilities:

| Suite                                                    | Integration contract                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `application/definition.test.tsx`                        | Application definitions, route compilation, RSC rendering, and client route outlets.       |
| `application/duplicate-module.test.ts`                   | Identity and interoperability across separately loaded framework module instances.         |
| `client/client-router.test.ts`                           | Navigation, Flight loading, React commit ordering, and response lifetimes.                 |
| `client/call-server.test.ts`                             | Server Function invocation, Flight results, route refresh, and browser rendering.          |
| `client/route-loader.test.ts`                            | Route loading and cache ownership across FlightClient and navigation.                      |
| `client/route-refresh.test.ts`                           | Refresh/navigation coordination and streamed-response ownership through render commits.    |
| `server/flight-html-stream.test.ts`                      | HTML injection and client reconstruction of embedded Flight streams.                       |
| `server/middleware.test.ts`                              | Application middleware acquisition/release through the real Effect HTTP web handler.       |
| `server/workers.test.tsx`                                | Application layers, request-scoped bindings, and public Workers Fetch response lifetimes.  |
| `server/catch-all.test.tsx`                              | Catch-all routing, decoded parameters, and malformed-path responses.                       |
| `server/userland-http.test.ts`                           | Application-provided native Effect HTTP routes and reserved protocol boundaries.           |
| `types/route-scaling.test.ts`                            | Type instantiation scaling through an independently invoked TypeScript compiler.           |
| `types/authoring.types.tsx`, `types/server-fn.types.tsx` | Compile-time authoring and Server Function contracts checked by the repository type check. |

## Architecture

### Runtime and lifetime contracts

- Preserve `ApplicationDefinition<Services, Error, Requirements>` external requirements and the distinction between request acquisition and construction-capability capture.
- Preserve the distinction between buffered responses, which may release after construction, and native streaming scope transfer through body consumption.
- Live request services override captured references. Never restore construction-time HTTP services, Scope, or Layer memo maps, and never reuse a construction memo map for application request layers.
- Preserve the pinned Effect HEAD normalization and response-URL compatibility regression tests when changing response handling or upgrading Effect.

### Application and browser contracts

- Maintain one opaque application identity across related factories and preserve runtime checks as well as compile-time authoring contracts.
- Keep route grammar types and runtime parsing paired, with corresponding type/runtime tests for grammar changes.
- Keep page-transition settings serializable. Live reduced-motion changes retain the mounted boundary, input value, and focus; changing explicit `enabled` may reset local state.
- Keep `internal/client-entry` and `internal/ssr-entry` as explicit integration exports, not general application APIs.

## Package-specific rules

- Preserve RSC directives, the `react-server` conditional root export, client transition CSS, and the explicit runtime subpaths in package output.

## Task-specific documentation

- When changing a public authoring or host contract: [core API](docs/API.md).
- When changing transition behavior or interpreting historical visual evidence: [ViewTransition validation](docs/VIEW-TRANSITIONS.md).
- When changing native construction or Alchemy integration: [Alchemy integration](../alchemy/docs/INTEGRATION.md).
- When changing the shared Workers hosting boundary: [host architecture](../../docs/WORKERS.md).
- When updating implementation-history references: [upstream provenance](../../docs/UPSTREAM.md).

_This AGENTS.md was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [AGENTS template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/agents/template.md)._
