---
name: effront
description: Build and verify Effront applications, select RSC, SSR, and browser entry points, configure host adapters, or migrate Hono rendering and host integration to Effront.
---

# Build an Effront application

1. Check the installed packages' `exports` and `peerDependencies` together. Match Effect, React, React DOM, Vite, and the selected adapter. For Alchemy, also check the adapter's supported host and lifecycle.
2. Define the application, routes, pages, layouts, and middleware in the RSC entry with one application-bound factory. Load the application through the `react-server` condition in the RSC graph only. Keep the SSR and browser graphs separate and put interactive components behind a `'use client'` boundary.
3. Select the host before wiring resources. Use the native Node/Bun listener for a native Effect handler or the Cloudflare adapter for Workers. Use the separate Alchemy adapter only for an Alchemy-managed application. Do not infer provider support from a portable Fetch handler.
4. Provide request-specific services through the application layer. Keep the scope open through response body completion or cancellation. Do not serialize bindings or execution contexts into HTML or Flight responses.
5. Build the actual Vite graphs, then exercise the selected host: request HTML, navigate, hydrate, invoke an action, and check stream cancellation or binding isolation when relevant.

For Hono applications, follow the [migration recipes](references/hono-migration.md) for application factories, JSX, styles, static assets, or host adapters.
For exact imports and peer requirements, consult the installed package metadata and the [framework API and package guides](https://github.com/totto2727-org/effront#api).
