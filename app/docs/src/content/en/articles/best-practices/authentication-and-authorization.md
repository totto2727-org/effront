Protect page access and Server Function execution independently.
A caller can invoke a Server Function without first visiting the Page that displays its form.

## Apply checks at each entry point {#entry-points}

Authenticate the current request before protected work begins.

| Entry point             | Protected work                          | Where to apply checks                            |
| ----------------------- | --------------------------------------- | ------------------------------------------------ |
| Route (Page and Layout) | Read and render protected data          | Middleware on the Routes that register the Page. |
| Server Function         | Execute a separately callable operation | The function's own Middleware or handler.        |
| Custom HTTP API         | Read or change data through an endpoint | HTTP middleware or the endpoint handler.         |

Custom HTTP endpoints use [HTTP middleware](/en/guide/http#global).

## Share one policy across both registrations {#shared-policy}

Use one middleware-derived factory for the protected Routes and Server Function.
In this example, `./auth` is an application-provided module, not an Effront authentication integration.
Its `checkEditorAccess` Effect verifies the current request's session and editor permission.
The helper returns `undefined` to allow access or an HTTP denial response, such as `401` or `403`, on failure.

Create `src/effront.ts`:

```typescript
import { Application } from "@effront/core";
import { Effect } from "effect";
import { checkEditorAccess } from "./auth";

export const EFFRONT = Application.effront();

const RequireEditor = EFFRONT.Middleware.make((next) =>
  Effect.fn("RequireEditor")(function* () {
    const rejection = yield* checkEditorAccess;
    if (rejection !== undefined) return rejection;
    return yield* next;
  })(),
);

export const EditorEFFRONT = EFFRONT.withMiddleware(RequireEditor);
```

Create `src/record-edit.ts` with the same factory:

```typescript
"use server";

import { Effect, Schema } from "effect";
import { EditorEFFRONT } from "./effront";

export const recordEdit = EditorEFFRONT.ServerFn.make({
  input: Schema.fromFormData(Schema.Struct({})),
  handler: () => Effect.logInfo("Editor action accepted"),
});
```

Register the Page through `EditorEFFRONT.Routes` in `src/entry.effront.tsx`:

```tsx
import { Effect } from "effect";
import { EFFRONT, EditorEFFRONT } from "./effront";
import { recordEdit } from "./record-edit";

const EditorPage = EditorEFFRONT.Page.make({
  render: () =>
    Effect.succeed(
      <form action={recordEdit}>
        <button type="submit">Record edit</button>
      </form>,
    ),
});

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html>
        <body>{children}</body>
      </html>,
    ),
});

export default EFFRONT.make({
  routes: EditorEFFRONT.Routes.make({ layout: RootLayout }).page("/editor", EditorPage),
});
```

The Routes registration checks access before rendering the Page and Layout.
The Server Function registration applies the same policy before the handler logs the accepted action.
Creating only a Page or Layout from `EditorEFFRONT` does not activate route middleware.
See the [Middleware guide](/en/guide/middleware) for request-specific services and nested scopes.

## Authorize each operation {#authorization}

After authentication, check whether the verified user may read or change the target record.
For example, constrain a project update to projects the user may edit.
Determine permissions from server-side data, not a submitted owner or role.
See [Server Function input contracts](/en/api-reference/server-functions#arguments) for Schema validation and client-supplied state.

Test these requests separately:

- An unauthorized user cannot view the protected Page.
- The same user cannot submit its Server Function request successfully.
- An authenticated user cannot change another user's record by submitting its ID.
