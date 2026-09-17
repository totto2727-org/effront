# Cloudflare Workers example

An Effront example that serves React Server Components on Cloudflare Workers without Alchemy, with request-scoped bindings, interactive React components, and Server Functions.

## Usage

Use the [runnable application](src/entry.effront.tsx) to render a greeting from Worker bindings and interact with it in the browser.
At `/`, the page shows `Hello from Cloudflare Workers`; clicking `Count: 0` changes the counter to `Count: 1`, and clicking `Call a Server Function` displays `Hello from Cloudflare Workers, Ada!`.
The About link navigates to `/about`, which displays the configured application label.

## Key features

- Server-rendered Home and About routes, including styled HTML with JavaScript disabled.
- A hydrated React counter and a typed Server Function.
- Request-scoped access to ordinary Cloudflare Worker bindings.
- Automatic Tailwind styles without a CSS file or manual CSS import.

## Prerequisites

- **Runtime**: Cloudflare Workers with `nodejs_compat`, or the local workerd runtime supplied by the Cloudflare Vite integration.
- **Local access**: No Alchemy package, Cloudflare account, or remote resource is required to run this example locally.

## Setup

Use the [example source](src/) as the starting point for your own application.
Follow [core Setup](../../packages/core/README.md#setup), [Vite Setup](../../packages/vite/README.md#setup), and [Cloudflare Setup](../../packages/cloudflare/README.md#setup) for the runtime and tooling dependencies.
Acquire the styling integration through [Tailwind Setup](../../packages/tailwind/README.md#setup).

Its Fetch entry connects the supplied application definition to the Worker:

```ts
import { createFetchHandler } from "@effront/core/workers";
import application from "./entry.effront";

export default { fetch: createFetchHandler(application) };
```

## API

### `/` and `/about`

The Home route renders the greeting and interactive controls; the About route renders the application label.

```text
GET /       -> HTML containing Hello from Cloudflare Workers
GET /about  -> HTML containing Effront + Cloudflare Workers
HEAD /      -> 200 with an empty body
```

### `APP_LABEL` and `GREETING`

Set these nonsecret Worker variables in `wrangler.jsonc` to change the About label and the greeting used by both the Home route and Server Function.

```json
{
  "vars": {
    "APP_LABEL": "Effront + Cloudflare Workers",
    "GREETING": "Hello from Cloudflare Workers"
  }
}
```

## Development

See [development instructions](../AGENTS.md#development-commands).

## License

[MIT License](../../LICENSE).

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
