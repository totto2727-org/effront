You can add interactive controls to an Effront page without moving its data access into the browser.
Keep server-side work in the Page or a reusable Server Component, then render Client Components wherever the user needs to interact.
The examples below assume you already have an application with a routed Page and a shared `EFFRONT` definition.

## Decide where the behavior belongs {#boundary}

Choose a component's role by the work it needs to do, rather than making the whole page server-only or client-only.

| What you need                                             | Where it belongs                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------- |
| Read an application service and turn its data into UI     | A Page or Server Component                                          |
| Respond to a click, track input, or update local UI state | A Client Component                                                  |
| Validate submitted input and update data on the server    | A [Server Function](/en/guide/server-functions), called from the UI |

For example, a page can display a greeting prepared on the server next to a counter managed in the browser.
The greeting needs no browser state, and incrementing the counter needs no server update.
Start with those two independent responsibilities, then compose their components in the Page.

## Extract a reusable server view {#server}

In `src/entry.effront.tsx`, use the application's existing `EFFRONT` value to define a shared server view with `Component.make`.
This example extracts the greeting into `Welcome` so other Pages can render it with different names.

```tsx
import { Effect } from "effect";

const Welcome = EFFRONT.Component.make({
  render: ({ name }: { readonly name: string }) => Effect.succeed(<p>こんにちは、{name} さん。</p>),
});

const HomePage = EFFRONT.Page.make({
  render: () => Effect.succeed(<Welcome name="Ada" />),
});
```

Use `HomePage` as your route's Page to display “こんにちは、Ada さん。”
The Page supplies `name` as a prop, and the component's `render` callback returns the greeting inside an Effect.
`Effect.succeed` is enough for this fixed text.
When a view needs service data, perform that work in the Effect returned by `render` and return the UI built from the result.
Components created from the same application's `EFFRONT` can use its application services, just as Pages can.

## Add a control without moving the Page {#client-boundary}

Put the interactive component in its own file, `src/components/counter.tsx`, with `"use client"` as the first statement.
Use React state and event handlers there, rather than adding them to the server-side `render` callback.

```tsx
"use client";

import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount((value) => value + 1)}>Count: {count}</button>;
}
```

Keep server-only service imports out of this file: `"use client"` also affects the modules it imports.
The [React reference](https://react.dev/reference/rsc/use-client) explains this boundary in more detail.

Back in `src/entry.effront.tsx`, import `Counter` and replace the earlier `HomePage` definition with the following one.
Keep `Welcome` and the existing `Effect` import in that file.

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

Open the route: the greeting appears alongside a button labelled `Count: 0`.
Each click increments the button's count while the Page keeps its server-side data access.

If a Client Component also needs data from the server, pass only the values it will display or use.
For example, pass a display name rather than the service that fetched it.
Props sent from the server to a Client Component must be [serializable by React](https://react.dev/reference/rsc/use-client#serializable-types-returned-by-server-components) and safe to disclose to the viewer.
Do not pass environment variables, a Request, or Effect services directly.
For a control that saves data on the server instead of only updating local state, use a Server Function as described above.

To add styles, follow the [Tailwind CSS guide](/en/guide/styling).
If you choose to load global CSS manually instead of using `effrontTailwind()`, import it from an exported Client Component that the Layout actually renders.
Importing CSS only from the application definition object may leave it out of the page.
