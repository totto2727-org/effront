## Choose the request scope {#reach}

Attach Middleware to Routes for page requests, and to the definition that creates a Server Function for its invocations.
A protected page does not automatically protect actions rendered on it.

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

Create `src/entry.effront.tsx`:

```tsx
import { Effect } from "effect";
import { EFFRONT, RequestEFFRONT, RequestInfo } from "./request-scope";

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="en">
        <body>{children}</body>
      </html>,
    ),
});

const RequestPage = RequestEFFRONT.Page.make({
  render: Effect.fn("RequestPage.render")(function* () {
    const info = yield* RequestInfo;
    return <p>Request URL: {info.url}</p>;
  }),
});

const routes = RequestEFFRONT.Routes.make({ layout: RootLayout }).page("/request", RequestPage);

export default EFFRONT.make({ routes });
```

Visit `/request` to see the request URL.
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

Import `Maintenance` in the entry and replace `RequestEFFRONT.Routes.make(...)` with `RequestEFFRONT.withMiddleware(Maintenance).Routes.make(...)`.
Requests now receive status 503 and `Under maintenance` instead of the Page.
For a conditional check, run `httpEffect` only when the request is allowed.

Authentication follows the same pattern: verify the session, reject invalid requests, and provide the verified user before continuing.
A username in a cookie or header is not proof of identity.

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

Restore the Routes without `Maintenance`, import `recordRequest` into the Page module, and include this form in its returned JSX:

```tsx
<form action={recordRequest}>
  <button type="submit">Record request</button>
</form>
```

Submitting logs `Form received` with the submission URL, not a value saved from the page request.
This Middleware only provides data.
For protected updates, attach actual authentication and authorization checks to the Server Function's definition.
See [Server Functions](/en/guide/server-functions) for returning form state.
