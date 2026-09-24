Custom HTTP endpoints let an Effront application return JSON alongside its rendered Pages, using the same application services.
The example adds `GET /api/greeting` to the application from the [services guide](/en/guide/effect) and applies a shared response header to the Page and API.

## Define a JSON endpoint {#router}

Create `src/http.ts`:

```typescript
import { Effect } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";
import { Greeting } from "./greeting";

export const GreetingApi = HttpRouter.use(
  Effect.fn(function* (router) {
    const greeting = yield* Greeting;
    yield* router.add(
      "GET",
      "/api/greeting",
      Effect.map(greeting.message("Ada"), (message) => HttpServerResponse.jsonUnsafe({ message })),
    );
  }),
);
```

Choose a path that does not overlap Page or Server Function URLs, and leave `/_effront` reserved.

> [!WARNING]
> Use `jsonUnsafe` only when the value is known to be JSON-serializable, as this string-valued object is.
> For endpoints that accept external input, validate it and handle failures as HTTP responses.

## Register the route and its service {#services}

In `src/entry.effront.tsx`, add `Layer` to the `effect` import and import `GreetingApi`.

```typescript
// src/entry.effront.tsx: replace the effect import.
import { Effect, Layer } from "effect";
// Add to the imports.
import { GreetingApi } from "./http";

// Replace the default export.
const ApplicationLayer = GreetingApi.pipe(Layer.provideMerge(Greeting.layer));

export default EFFRONT.make({ routes, layer: ApplicationLayer });
```

`Layer.provideMerge` supplies `Greeting` to the route registration and retains it for the Page.
Open `/api/greeting` at the URL displayed by the development server.
Expect status `200`, content type `application/json`, and:

```json
{ "message": "Hello, Ada." }
```

The existing `/` Page still displays the greeting.

## Keep resources request-local {#boundary}

The application Layer is built for each request, including custom HTTP requests.
Keep connections and other scoped resources within that request, whose scope lasts through response-body completion, failure, or cancellation.

> [!WARNING]
> Do not save request-specific services in module-level variables for later requests.

## Add a shared response header {#global}

Create `src/application-layer.ts`:

```typescript
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";
import { Greeting } from "./greeting";
import { GreetingApi } from "./http";

const GlobalHeaders = HttpRouter.middleware(
  (httpEffect) =>
    Effect.map(httpEffect, HttpServerResponse.setHeader("x-content-type-options", "nosniff")),
  { global: true },
);

export const ApplicationLayer = Layer.mergeAll(GreetingApi, GlobalHeaders).pipe(
  Layer.provideMerge(Greeting.layer),
);
```

In `src/entry.effront.tsx`, import the shared Layer and remove the local definition and unused imports:

```typescript
// src/entry.effront.tsx: replace the effect import to remove Layer.
import { Effect } from "effect";
// Replace the GreetingApi import.
import { ApplicationLayer } from "./application-layer";

// Remove the local ApplicationLayer declaration.
export default EFFRONT.make({ routes, layer: ApplicationLayer });
```

Both `/` and `/api/greeting` now include `x-content-type-options: nosniff`.

`global: true` covers Pages, Server Functions, custom routes, and unmatched requests.
Use [scoped Middleware](/en/guide/middleware) for a policy limited to one Routes group.

> [!NOTE]
> This example maps only successful downstream responses.
> An unmatched request fails with `RouteNotFound`, so its final 404 does not receive the header unless you handle that error and return a response.
> Host-served static assets and the runtime's early oversized-request 413 response bypass the router entirely.
> Configure asset headers on the host.
