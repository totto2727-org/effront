# Cloudflare Workers example

This example renders a greeting from Cloudflare Worker bindings and calls a Server Function from an interactive React page, without Alchemy.

## Usage

In the [runnable application](src/entry.effront.tsx):

1. Open `/` and find `Hello from Cloudflare Workers`, the greeting supplied by the Worker.
2. Click **Count: 0**. The hydrated counter changes to **Count: 1**.
3. Click **Call a Server Function**. The result is `Hello from Cloudflare Workers, Ada!`.
4. Follow **About** to `/about` to see the configured application label.

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
Install the styling integration through [Tailwind Setup](../../packages/tailwind/README.md#setup).

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

Set these nonsecret Worker variables in `wrangler.jsonc`:

| Variable    | Used by                                            |
| ----------- | -------------------------------------------------- |
| `APP_LABEL` | The label on `/about`                              |
| `GREETING`  | The greeting on `/` and the Server Function result |

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
