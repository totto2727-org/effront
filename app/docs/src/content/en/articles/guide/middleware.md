Use Middleware to prepare request information for the pages and form handlers that need it.
It is also a place to enforce access checks before those handlers do any work.
You decide both what happens to the request and which parts of the application use that behavior.
The example below makes the current URL available as a service, then shows how to replace normal processing with a maintenance response and how to handle form submissions.

## Choose which requests to cover {#reach}

For page requests, attach Middleware to the Routes that should use it.
For a Server Function, attach it to the definition that creates the function, so the check runs when the function is invoked.
These are scoped behaviors: adding Middleware to one group of Routes does not make it an application-wide policy.

If the same behavior must cover custom HTTP endpoints or unmatched requests, use [global HTTP Middleware](/en/guide/http#global) for that wider policy.
That registration covers the router inside Effront's Fetch handler, not static assets served directly by the host.
Configure those assets at the host level when they need the same headers or access restrictions.

## Prepare a service for downstream work {#view}

Create `src/request-scope.ts` with the service that consumers will read and the Middleware that supplies its value.
In this example, `RequestInfo` contains the URL from the current HTTP request.

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

The handler receives `httpEffect`, which represents the work it wraps.
Running that Effect continues the request, and `Effect.provideService` makes the URL available to that work as `RequestInfo`.
The `provides: RequestInfo` type declaration tells the derived definitions which service they can use, but does not supply a value by itself.
Keep the declaration and the call to `Effect.provideService` together.

`EFFRONT.withMiddleware(WithRequestInfo)` returns `RequestEFFRONT`, a definition in the same application with the additional Middleware and service available.
Use it to create the consumers and the Routes that need this behavior.

## Display the service value on a page {#routes}

In `src/entry.effront.tsx`, create a Page that reads `RequestInfo` and register it using `RequestEFFRONT.Routes.make`.

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

Visit `/request` to see “Request URL:” followed by the current request URL.
The Middleware supplies the value, and the Page only reads and displays it.
A Layout or Component created through `RequestEFFRONT` can read the same service when rendered inside these Routes.

Keep the Page and its Routes paired: creating a Page through `RequestEFFRONT` does not activate Middleware when that Page is registered in the base `EFFRONT.Routes`.
For a larger application, `mount` the Middleware-equipped Routes inside parent Routes to limit the behavior to that part of the site.

## Stop a request before its handler runs {#order}

A service-providing handler continues by running `httpEffect`.
To prevent the downstream work from running, return an HTTP response instead.
For example, put this alternative Middleware in `src/maintenance.ts`:

```typescript
import { Effect } from "effect";
import { HttpServerResponse } from "effect/unstable/http";
import { EFFRONT } from "./request-scope";

export const Maintenance = EFFRONT.Middleware.make(() =>
  Effect.succeed(HttpServerResponse.text("Under maintenance", { status: 503 })),
);
```

After importing `Maintenance` into the entry module, create the affected Routes through `RequestEFFRONT.withMiddleware(Maintenance).Routes.make(...)` instead of `RequestEFFRONT.Routes.make(...)`.
Requests to those Routes now receive status 503 and “Under maintenance” rather than the page.
This example always stops processing.
A conditional policy should run `httpEffect` only in the branch that allows the request to proceed.

An authentication check follows the same decision: validate a session, return a response such as 401 if validation fails, and otherwise provide the verified user as a service before continuing.
A username supplied in a cookie or header is input to verify, not proof of identity.

When several checks are needed, `EFFRONT.withMiddleware(first).withMiddleware(second)` enters `first`, then `second`, then the downstream handler.
Code that processes the returned response runs in the reverse order.
An early response skips the remaining inner handlers, so put checks in the order they should run.
Do not add the same Middleware twice to one chain.

## Apply the behavior to form submissions {#actions}

An update needs its own request-time checks even if the page containing its form was protected.
A Server Function uses the Middleware attached to its own definition, rather than acquiring protection just by appearing on a page.
For an authenticated update, create the function through the definition that includes your authentication Middleware.

If you temporarily enabled the maintenance example, restore the previous Routes definition before trying the form.
To try service access on a submission, create `src/record-request.ts` and define its handler with `RequestEFFRONT`:

```typescript
"use server";

import { Effect, Schema } from "effect";
import { RequestEFFRONT, RequestInfo } from "./request-scope";

export const recordRequest = RequestEFFRONT.ServerFn.make({
  input: Schema.fromFormData(Schema.Struct({})),
  handler: () =>
    Effect.gen(function* () {
      const info = yield* RequestInfo;
      yield* Effect.logInfo("Form received", { url: info.url });
    }),
});
```

Import `recordRequest` into the Page module and include this form in its rendered output.
The function accepts form data and returns no value, so it can be passed directly to `action`.

```tsx
<form action={recordRequest}>
  <button type="submit">Record request</button>
</form>
```

Submit the form and check the server log for “Form received” and the submission URL.
The Middleware reads the request for this invocation, not a value saved when the page was displayed.
The URL Middleware used here only provides data.
Add your actual access check to the Server Function's definition before using the same pattern for a protected update.
