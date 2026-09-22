Use Effect services to keep application logic separate from the Pages that call it.
The greeting example gives a Page a replaceable service, with its implementation and lifetime managed through an Effect Layer.

Continue in the running [Getting started sample](./getting-started.md), which serves [http://127.0.0.1:1340](http://127.0.0.1:1340).

## Use a service in a Page {#service}

Create `src/greeting.ts`:

```typescript
import { Context, Effect, Layer } from "effect";

export class Greeting extends Context.Service<
  Greeting,
  { readonly message: (name: string) => Effect.Effect<string> }
>()("app/services/Greeting") {
  static readonly layer = Layer.succeed(Greeting, {
    message: (name) => Effect.succeed(`Hello, ${name}.`),
  });
}
```

In `src/entry.effront.tsx`, declare `Greeting`, read it in the Page, and provide its Layer:

```tsx
import { Effect } from "effect";
import { Application } from "@effront/core";
import { Greeting } from "./greeting";

const EFFRONT = Application.effront<Greeting>();

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="en">
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

export default EFFRONT.make({ routes, layer: Greeting.layer });
```

Open [http://127.0.0.1:1340](http://127.0.0.1:1340) to see `Hello, Ada.`
To replace the implementation, pass another Layer that provides `Greeting` without changing the Page.

## Choose the service scope {#lifetime}

Application services are available to Pages, Layouts, Components, and Server Functions created from the same `EFFRONT`.
For multiple services, declare a union such as `Application.effront<ServiceA | ServiceB>()` and supply a Layer that provides both.
See Effect's [Services](https://effect.website/docs/requirements-management/services/) and [Layers](https://effect.website/docs/requirements-management/layers/) guides for composition.

Effront builds the application Layer for each request.
Scoped resources remain available through response-body completion, failure, or cancellation, not just until a Page returns JSX.
Do not cache request-specific service instances in module-level variables.

For a service needed only by selected routes or actions, use [Middleware](/en/guide/middleware).
Apply that Middleware to the Routes as well as the Page's definition.

## Fix missing-service errors {#missing-services}

| Error location     | Check                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| Page `render`      | Declare the service in `Application.effront<Services>()`, or use a Middleware-equipped definition. |
| `EFFRONT.make`     | Supply `layer` when application services are declared.                                             |
| The supplied Layer | Provide every declared service. `Layer.empty` cannot provide `Greeting`.                           |

For Middleware-provided services, fix the active scope rather than adding an application-wide implementation to suppress the error.
