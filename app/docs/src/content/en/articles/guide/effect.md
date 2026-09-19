Use application services to make server-side dependencies explicit while choosing their implementations in one place.
This is useful when several Pages need the same data-access interface, or when you want to substitute a test implementation without rewriting the code that calls it.
In Effront, the application declares which services its handlers may use and supplies their implementations through a Layer.

The example below connects a greeting service to a Page.
It shows the complete path from a service contract to rendered output, then explains how to extend that setup without losing track of request scope.

## Connect a dependency to a Page {#service}

Begin with the operation the Page needs: given a name, produce a greeting.
Define that contract as `Greeting` in `src/greeting.ts`, with `Greeting.layer` providing a simple implementation:

```typescript
import { Context, Effect, Layer } from "effect";

export class Greeting extends Context.Service<
  Greeting,
  { readonly message: (name: string) => Effect.Effect<string> }
>()("app/services/Greeting") {
  static readonly layer = Layer.succeed(Greeting, {
    message: (name) => Effect.succeed(`こんにちは、${name} さん。`),
  });
}
```

Connect the service in `src/entry.effront.tsx` with two application-level decisions.
`Application.effront<Greeting>()` declares that the Page may depend on `Greeting`.
The `layer` option of `EFFRONT.make` selects the implementation to supply.
Both are needed: a type declaration alone cannot provide the service at runtime.

The Page can then retrieve `Greeting` with `yield* Greeting` and call its `message` method:

```tsx
import { Effect } from "effect";
import { Application } from "@effront/core";
import { Greeting } from "./greeting";

const EFFRONT = Application.effront<Greeting>();

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="ja">
        <body>{children}</body>
      </html>,
    ),
});

const HomePage = EFFRONT.Page.make({
  render: Effect.fn("HomePage.render")(function* () {
    const greeting = yield* Greeting;
    const message = yield* greeting.message("Ada");
    return <h1>{message}</h1>;
  }),
});

const routes = EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage);

export default EFFRONT.make({
  routes,
  layer: Greeting.layer,
});
```

Open `/` in this application to see “こんにちは、Ada さん。” (a Japanese greeting to Ada).
The Page knows how to ask for a greeting, but it does not select or construct the implementation.
To change the implementation, supply another Layer that provides the same `Greeting` contract at `EFFRONT.make`.

## Extend usage while keeping request scope {#lifetime}

Once connected, the service is also available to Layouts, Components, and Server Functions created from the same EFFRONT.
To add other application services, declare a union such as `Application.effront<ServiceA | ServiceB>()` and supply a Layer that provides all of them.
For designing service contracts and composing those Layers, use the official [Effect Services](https://effect.website/docs/requirements-management/services/) and [Layers documentation](https://effect.website/docs/requirements-management/layers/).

Making a service available to these definitions does not make it server-global.
The application Layer is built for each request rather than once at server startup.
If a service acquires resources in the request scope, those resources remain available until the response body finishes, fails, or is cancelled.
Returning JSX from a Page is not the end of that lifetime because the response may still be streaming.
Keep request-specific connections and values out of module-global caches.

Some dependencies belong to a narrower part of the application, such as authenticated-user information needed by protected routes and actions.
Supply those through [Middleware](/en/guide/middleware), where they are available within the active Middleware scope.
For Pages, creating the Page from an EFFRONT with Middleware does not activate the scope on its own: apply it through Routes as described in that guide.

## Resolve service wiring errors {#missing-services}

The type checker helps keep a handler's requirements aligned with the services declared and supplied by the application.
If the greeting example fails to type-check, follow the dependency from its caller back to its provider:

1. **Error in `render`: check the service declaration.**
   A Page that uses `Greeting` needs an EFFRONT that makes it available, so use `Application.effront<Greeting>()` rather than `Application.effront()`.
2. **Error in `EFFRONT.make`: check for a missing `layer`.**
   Declaring application services makes this option required, so pass `layer: Greeting.layer`.
3. **Rejected `layer`: check which services it supplies.**
   `Layer.empty` cannot satisfy the `Greeting` requirement, and a Layer for only some services cannot satisfy a declaration that requires all of them.

For a Middleware-provided service, check the Middleware scope instead of adding an application-wide implementation merely to silence the error.
