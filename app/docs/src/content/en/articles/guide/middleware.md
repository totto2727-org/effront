Effront Middleware runs checks or provides request-specific services around page requests and Server Function calls.
Use it for shared behavior such as checking authentication or making the current user available to application code.

## Choose the request scope {#reach}

You can apply Middleware to:

- Routes
- Server Functions

Create Routes and Server Functions from a shared middleware-equipped application definition to apply the same Middleware to both.

For policies that also cover custom HTTP endpoints and unmatched requests, use [global HTTP Middleware](/en/guide/http#global).
Host-served static assets need host-level configuration.

## Provide a request service {#view}

Create `src/request-scope.ts` to expose the current request URL as a service:

```typescript
import { Context, Effect } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { Application } from "@effront/core";

export class RequestInfo extends Context.Service<RequestInfo, { readonly url: string }>()(
  "app/middleware/RequestInfo",
) {}

export const EFFRONT = Application.effront();

const WithRequestInfo = EFFRONT.Middleware.make<{ provides: RequestInfo }>(
  Effect.fn(function* (httpEffect) {
    const request = yield* HttpServerRequest.HttpServerRequest;
    return yield* httpEffect.pipe(Effect.provideService(RequestInfo, { url: request.url }));
  }),
);

export const RequestEFFRONT = EFFRONT.withMiddleware(WithRequestInfo);
```

`provides: RequestInfo` declares the service, while `Effect.provideService` supplies its value to downstream work.
Run `httpEffect` to continue the request.
Use the derived `RequestEFFRONT` to define consumers and Routes for this scope.

## Apply the service to a Page {#routes}

Update `src/entry.effront.tsx` to use the shared definition and replace the homepage with `/request`:

```tsx
// src/entry.effront.tsx: replace the Application import.
import { EFFRONT, RequestEFFRONT, RequestInfo } from "./request-scope";

// Remove the local EFFRONT declaration.
// Replace HomePage with RequestPage.
const RequestPage = RequestEFFRONT.Page.make({
  render: Effect.fn("RequestPage.render")(function* () {
    const info = yield* RequestInfo;
    return <p>Request URL: {info.url}</p>;
  }),
});

// Replace the default export with this route declaration and export.
const routes = RequestEFFRONT.Routes.make({ layout: RootLayout }).page("/request", RequestPage);

export default EFFRONT.make({ routes });
```

Open `/request` to see the request URL.
Creating the Page through `RequestEFFRONT` is not enough: its Routes must activate the Middleware too.
Layouts and Components created through `RequestEFFRONT` can read the service when rendered inside that scope.
To limit it to one section, mount these Routes inside parent Routes.

## Return an early response {#order}

To stop downstream work, return a response without running `httpEffect`.
For example, create `src/maintenance.ts`:

```typescript
import { Effect } from "effect";
import { HttpServerResponse } from "effect/unstable/http";
import { EFFRONT } from "./request-scope";

export const Maintenance = EFFRONT.Middleware.make(() =>
  Effect.succeed(HttpServerResponse.text("Under maintenance", { status: 503 })),
);
```

In `src/entry.effront.tsx`, import and apply `Maintenance` to the Routes:

```tsx
// src/entry.effront.tsx: add to the imports.
import { Maintenance } from "./maintenance";

// Replace routes to apply Maintenance.
const routes = RequestEFFRONT.withMiddleware(Maintenance)
  .Routes.make({
    layout: RootLayout,
  })
  .page("/request", RequestPage);
```

Requests now receive status 503 and `Under maintenance` instead of the Page.
For a conditional check, run `httpEffect` only when the request is allowed.

Authentication follows the same pattern: verify the session, reject invalid requests, and provide the verified user before continuing.

Chained Middleware enters in declaration order and processes responses in reverse order.
An early response skips the remaining inner handlers.
Do not add the same Middleware twice to a chain.

## Apply checks to a Server Function {#actions}

Define the action with the Middleware-equipped `RequestEFFRONT` in `src/record-request.ts`:

```typescript
"use server";

import { Effect, Schema } from "effect";
import { RequestEFFRONT, RequestInfo } from "./request-scope";

export const recordRequest = RequestEFFRONT.ServerFn.make({
  input: Schema.fromFormData(Schema.Struct({})),
  handler: Effect.fn("recordRequest")(function* () {
    const info = yield* RequestInfo;
    yield* Effect.logInfo("Form received", { url: info.url });
  }),
});
```

In `src/entry.effront.tsx`, remove `Maintenance`, restore the Routes, and add the form to `RequestPage`:

```tsx
// src/entry.effront.tsx: replace the Maintenance import.
import { recordRequest } from "./record-request";

// Replace RequestPage to include the form.
const RequestPage = RequestEFFRONT.Page.make({
  render: Effect.fn("RequestPage.render")(function* () {
    const info = yield* RequestInfo;
    return (
      <>
        <p>Request URL: {info.url}</p>
        <form action={recordRequest}>
          <button type="submit">Record request</button>
        </form>
      </>
    );
  }),
});

// Replace routes to remove Maintenance.
const routes = RequestEFFRONT.Routes.make({ layout: RootLayout }).page("/request", RequestPage);
```

Submitting logs `Form received` with the submission URL, not a value saved from the page request.

See [Server Functions](/en/guide/server-functions) for returning form state.
