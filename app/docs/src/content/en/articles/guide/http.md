Add `GET /api/greeting` to the application from the [services guide](/en/guide/effect) while keeping its existing Page.

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
Use `jsonUnsafe` only when the value is known to be JSON-serializable, as this string-valued object is.
For endpoints that accept external input, validate it and handle failures as HTTP responses.

## Register the route and its service {#services}

In `src/entry.effront.tsx`, add `Layer` to the `effect` import and import `GreetingApi`.
Keep `EFFRONT`, `Greeting`, and `routes` from the services example, then replace the default export:

```typescript
import { Layer } from "effect";
import { GreetingApi } from "./http";

const ApplicationLayer = GreetingApi.pipe(Layer.provideMerge(Greeting.layer));

export default EFFRONT.make({ routes, layer: ApplicationLayer });
```

`Layer.provideMerge` supplies `Greeting` to the route registration and retains it for the Page.
Request `/api/greeting` on your application's origin.
Expect status `200`, content type `application/json`, and:

```json
{ "message": "Hello, Ada." }
```

The existing `/` Page still displays the greeting.

## Keep resources request-local {#boundary}

The application Layer is built for each request, including custom HTTP requests.
Keep connections and other scoped resources within that request, whose scope lasts through response-body completion, failure, or cancellation.
Do not save request-specific services in module-level variables for later requests.

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

In the entry module, replace the local `ApplicationLayer` definition with `import { ApplicationLayer } from "./application-layer"` and continue passing it to `EFFRONT.make`.
Remove the now-unused `Layer` and `GreetingApi` imports from the entry module.
Both `/` and `/api/greeting` now include `x-content-type-options: nosniff`.

`global: true` covers Pages, Server Functions, custom routes, and unmatched requests.
Use [scoped Middleware](/en/guide/middleware) for a policy limited to one Routes group.

This example maps only successful downstream responses.
An unmatched request fails with `RouteNotFound`, so its final 404 does not receive the header unless you handle that error and return a response.
Host-served static assets and the runtime's early oversized-request 413 response bypass the router entirely.
Configure asset headers on the host.
