Use a custom HTTP route when a caller needs data rather than a rendered Page.
You can expose application services through a JSON endpoint while keeping the Pages that already use those services.

The example below extends the application from the [services guide](/en/guide/effect): `/` continues to display a greeting, and `GET /api/greeting` returns that greeting as JSON.
First define the endpoint, then include its registration in the application's Layer and check the response.
After that, you can add a response header across both kinds of route.

## Define the JSON endpoint {#router}

Create `src/http.ts` with the following route registration.
`HttpRouter.use` gives the registration access to the router, and `router.add` associates a method and path with the Effect that produces the response.
Here, the handler calls `message("Ada")` on the `Greeting` service and wraps the result in an object with a `message` field.

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

When choosing your own endpoint path, keep it distinct from Page and Server Function URLs and leave the reserved `/_effront` namespace unused.
`HttpServerResponse.jsonUnsafe` is appropriate here because the object contains a string known to be JSON-serializable.
For an endpoint that accepts external input, validate that input and decide how processing failures should become HTTP responses.

## Register the endpoint and make a request {#services}

Exporting `GreetingApi` alone does not connect it to the application.
In `src/entry.effront.tsx`, combine it with `Greeting.layer` and pass the result to `EFFRONT.make` in place of the existing `layer: Greeting.layer`.
Keep the `EFFRONT` and `routes` definitions from the services guide.

```typescript
import { Layer } from "effect";
import { Greeting } from "./greeting";
import { GreetingApi } from "./http";

const ApplicationLayer = GreetingApi.pipe(Layer.provideMerge(Greeting.layer));

// Keep the EFFRONT and routes definitions from the services guide.
export default EFFRONT.make({ routes, layer: ApplicationLayer });
```

`Layer.provideMerge` does two jobs here: it supplies the service needed to register the HTTP route, and it retains that service in the output for the Page to use.
This lets the API and Page depend on the same service contract without duplicating its implementation.

With the development application running, open `/api/greeting` on its origin and inspect the request in your browser's Network panel.
Expect status `200`, a `Content-Type` containing `application/json`, and this response body:

```json
{ "message": "こんにちは、Ada さん。" }
```

Open `/` as well to confirm that the existing Page still displays the greeting.
The Japanese text comes from the sample service and is the same in both responses.
If your endpoint needs another status, set it on the response, as in `HttpServerResponse.jsonUnsafe({ accepted: true }, { status: 202 })`.

## Keep service resources within the request {#boundary}

Sharing a service between route definitions does not make it a server-wide singleton.
Effront builds the application Layer for each request.
If you replace the greeting implementation with one that acquires a connection or another scoped resource, use that resource only within its request lifetime.
The request scope is retained through response-body completion, failure, or cancellation, so producing response headers is not the end of that lifetime.
Do not cache request-specific service instances in module-level variables for later requests.

## Add a header to Page and API responses {#global}

Once the endpoint works, you can apply a common response policy without adding code to each handler.
For example, the following global middleware adds `x-content-type-options: nosniff` to successful responses from Effront's router.

Put this combined Layer in `src/application-layer.ts`.
In `src/entry.effront.tsx`, replace the local `ApplicationLayer` definition with an import from `./application-layer` and continue passing it to `EFFRONT.make`.

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

Request `/api/greeting` and `/` again and check that both responses include the new header.
The `global: true` option applies middleware to the whole router, including Pages, Server Functions, custom HTTP routes, and unmatched requests.
If the policy belongs only to a particular Routes scope, use [scoped Middleware](/en/guide/middleware) instead.

The scope of the middleware and the responses changed by this example are different questions:

- `Effect.map` changes only a response returned successfully by the downstream Effect.
  An unmatched request fails with `RouteNotFound`, so the final 404 does not get this header.
  To change an error response too, handle the relevant HTTP error and convert it into a response.
- Responses sent before the router runs bypass this middleware.
  This includes static assets served directly by the host and the runtime's early 413 response for an oversized request.
  Set asset headers on the host that serves those assets.
