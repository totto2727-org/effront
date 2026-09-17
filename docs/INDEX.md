# Cross-package documentation index

This directory is a developer/reference index, not a consumer package README.
For application setup and public APIs, start with the [Effront README](../README.md).

## Shared architecture and operations

- [Workers architecture](WORKERS.md): core, Vite, Cloudflare, and browser graph boundaries.
- [Test boundaries](TESTING.md): cross-package unit, integration, browser, and HMR ownership.
- [Release policy](PUBLISHING.md): shared packaging, npm CI, version policy, and publication authorization.
- [Roadmap](ROADMAP.md): deferred features and host adapters spanning the framework.
- [Upstream provenance](UPSTREAM.md): retained history, licenses, and incorporation records.

## Owner-specific guides

- [Alchemy integration](../packages/alchemy/docs/INTEGRATION.md): native construction, host context, and local profile boundaries.
- [Page View Transitions](../packages/core/docs/VIEW-TRANSITIONS.md): core navigation and transition semantics.
- [Markdown guide](../packages/markdown/docs/GUIDE.md): collections, rendering, assets, and parser contracts.
- [Gitignore verification](../packages/gitignore-patterns/docs/VALIDATION.md): generator behavior and CLI limitations.
- [Documentation-site authoring](../app/docs/docs/AUTHORING.md): page and implementation-excerpt maintenance.

## Historical cross-package verification

- [Workers migration evidence](WORKERS-VALIDATION.md): the original runtime/build migration and its observed checks.
- [Rename and plugin-boundary evidence](EFFRONT-VALIDATION.md): the framework-wide naming and compiler integration milestone.

Historical commands and observations are not the current development workflow; use [AGENTS.md](../AGENTS.md) for current commands.
