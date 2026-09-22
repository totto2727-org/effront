# Cross-package documentation index

For application setup and public APIs, start with the [Effront README](../README.md).
For framework maintenance, choose the reference below that matches your change.

## Shared architecture and operations

| Maintainer task                                  | Reference                          |
| ------------------------------------------------ | ---------------------------------- |
| Change core, Vite, or Cloudflare boundaries      | [Workers architecture](WORKERS.md) |
| Select unit, integration, browser, or HMR checks | [Test boundaries](TESTING.md)      |
| Prepare package versions or publication          | [Release policy](PUBLISHING.md)    |
| Evaluate a deferred feature or host adapter      | [Roadmap](ROADMAP.md)              |
| Compare or incorporate upstream changes          | [Upstream provenance](UPSTREAM.md) |

## Owner-specific guides

- [Alchemy integration](../packages/alchemy/docs/INTEGRATION.md): native construction, host context, and local profile boundaries.
- [Page View Transitions](../packages/core/docs/VIEW-TRANSITIONS.md): core navigation and transition semantics.
- [Markdown guide](../packages/markdown/docs/GUIDE.md): collections, rendering, assets, and parser contracts.
- [External Gitignore generator](https://jsr.io/@totto2727/gitignore-patterns/doc): the separately maintained dependency used by repository formatting and lint configuration.
- [Documentation-site authoring](../app/docs/docs/AUTHORING.md): page and implementation-excerpt maintenance.

## Historical cross-package verification

- [Workers migration evidence](WORKERS-VALIDATION.md): the original runtime/build migration and its observed checks.
- [Rename and plugin-boundary evidence](EFFRONT-VALIDATION.md): the framework-wide naming and compiler integration milestone.

Historical commands and observations are not the current development workflow; use [AGENTS.md](../AGENTS.md) for current commands.
