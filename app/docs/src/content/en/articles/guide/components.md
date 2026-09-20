Combine server-rendered UI with interactive Client Components without moving data access into the browser.
The example pairs a reusable greeting with a counter, showing where each kind of component belongs.

## Choose a component for the task {#boundary}

| Task                                 | Use                                             |
| ------------------------------------ | ----------------------------------------------- |
| Read services and render data        | A Page or `EFFRONT.Component`                   |
| Handle clicks, input, or local state | A Client Component                              |
| Submit data to the server            | A [Server Function](/en/guide/server-functions) |

Keep data access on the server and add Client Components only where interaction is needed.

## Reuse server-rendered UI {#server}

In the application entry from [Routes](./routes.md#pages), define `Welcome` and replace `HomePage` with:

```tsx
const Welcome = EFFRONT.Component.make({
  render: ({ name }: { readonly name: string }) => Effect.succeed(<p>Hello, {name}.</p>),
});

const HomePage = EFFRONT.Page.make({
  render: () => Effect.succeed(<Welcome name="Ada" />),
});
```

Keep the entry's `Effect` import, `EFFRONT`, RootLayout, and route registration.
Opening `/` displays `Hello, Ada.`
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

Import it in `src/entry.effront.tsx` and replace `HomePage` again:

```tsx
import { Counter } from "./components/counter";

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

Open `/` and click `Count: 0` to increment the counter.
The greeting remains server-rendered.

Keep server-only service imports out of Client Components and the modules they import.
Pass display values, not services, Requests, or environment objects, as props.
Those values must be [serializable by React](https://react.dev/reference/rsc/use-client#serializable-types-returned-by-server-components) and safe to disclose to the viewer.
See React's [`"use client"` reference](https://react.dev/reference/rsc/use-client) for the boundary rules.

For styles, use the [Tailwind integration](/en/guide/styling).
If you load global CSS manually instead, import it from an exported Client Component that the Layout renders, not only from the application definition module.
