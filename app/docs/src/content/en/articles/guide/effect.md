Use Effect services to keep application logic separate from the Pages that call it.
The greeting example gives a Page a service.
An Effect Layer controls the service's implementation and lifetime.

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

In `src/entry.effront.tsx`, declare `Greeting`.
Read it in the Page.
Then supply its Layer:

```tsx
// src/entry.effront.tsx: add to the imports.
import { Greeting } from "./greeting";

// Replace EFFRONT.
const EFFRONT = Application.effront<Greeting>();

// Replace HomePage.
const HomePage = EFFRONT.Page.make({
  render: Effect.fn("HomePage.render")(function* () {
    const greeting = yield* Greeting;
    const message = yield* greeting.message("Ada");
    return <h1>{message}</h1>;
  }),
});

// Replace the default export with this route declaration and export.
const routes = EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage);

export default EFFRONT.make({ routes, layer: Greeting.layer });
```

Open `/` to see `Hello, Ada.`
To replace the implementation, pass another Layer that provides `Greeting` without changing the Page.

## Choose the service scope {#lifetime}

Application services are available to Pages, Layouts, Components, and Server Functions created from the same `EFFRONT`.
For multiple services, declare a union such as `Application.effront<ServiceA | ServiceB>()`.
Then supply a Layer that supplies both services.
Refer to Effect's [Services](https://effect.website/docs/requirements-management/services/) and [Layers](https://effect.website/docs/requirements-management/layers/) guides for composition.

Effront builds the application Layer for each request.
A Page's JSX result does not release its scoped resources.
The resources remain available until the response body completes, fails, or is canceled.

> [!WARNING]
> Do not cache request-specific service instances in module-level variables.
> This can share user data across requests.
> It can also use resources again after the original request released them.

## Fix missing-service errors {#missing-services}

| Error location     | Check                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| Page `render`      | Declare the service in `Application.effront<Services>()`, or use a Middleware-equipped definition. |
| `EFFRONT.make`     | When application services are declared, supply `layer`.                                            |
| The supplied Layer | Provide every declared service. `Layer.empty` cannot provide `Greeting`.                           |

For services supplied by Middleware, correct the active scope.
Do not add an application-wide implementation only to suppress the error.
