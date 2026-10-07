Combine server-rendered UI with interactive Client Components without moving data access into the browser.
The example pairs a greeting component with a counter.
It shows where each kind of component belongs.

## Choose a component for the task {#boundary}

| Task                                 | Use                                             |
| ------------------------------------ | ----------------------------------------------- |
| Read services and render data        | A Page or `EFFRONT.Component`                   |
| Handle clicks, input, or local state | A Client Component                              |
| Submit data to the server            | A [Server Function](/en/guide/server-functions) |

Keep data access on the server.
Add Client Components only where users interact with the page.

## Reuse server-rendered UI {#server}

In `src/entry.effront.tsx` from [Routes](./routes.md#application), define `Welcome`.
Then replace `HomePage`:

```tsx
// src/entry.effront.tsx: add before HomePage.
const Welcome = EFFRONT.Component.make({
  render: ({ name }: { readonly name: string }) => Effect.succeed(<p>Hello, {name}.</p>),
});

// Replace HomePage.
const HomePage = EFFRONT.Page.make({
  render: () => Effect.succeed(<Welcome name="Ada" />),
});
```

Open `/` to see `Hello, Ada.`
For data-backed UI, read [application services](./effect.md) inside the Effect returned by `render`.

## Add an interactive control {#client-boundary}

Create `src/components/counter.tsx` with `"use client"` as its first statement:

```tsx
"use client";

import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount((value) => value + 1)}>Count: {count}</button>;
}
```

Import it in `src/entry.effront.tsx`.
Then replace `HomePage` again:

```tsx
// src/entry.effront.tsx: add to the imports.
import { Counter } from "./components/counter";

// Replace HomePage.
const HomePage = EFFRONT.Page.make({
  render: () =>
    Effect.succeed(
      <>
        <Welcome name="Ada" />
        <Counter />
      </>,
    ),
});
```

Open `/`.
Click `Count: 0` to increase the counter.
Effront renders the `Welcome` component on the server.

> [!WARNING]
> Keep server-only service imports out of Client Components and the modules they import.
> Pass display values, not services, Requests, or environment objects, as props.
> Make sure that React can [serialize those values](https://react.dev/reference/rsc/use-client#serializable-types-returned-by-server-components).
> These values can reach the viewer's browser.
> Pass only values that are safe for the viewer to receive.

Refer to React's [`"use client"` reference](https://react.dev/reference/rsc/use-client) for the boundary rules.
