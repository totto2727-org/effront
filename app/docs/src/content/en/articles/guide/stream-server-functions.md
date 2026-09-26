Use a Stream Server Function when a server read produces a sequence of values and the Client Component should render each value as it arrives.
A standard mutation is still the right choice for writes that navigate or refresh the current route.

## Return a stream {#server}

A Stream Server Function has the usual validated input and returns an Effect `Stream` from its handler.
For example, the handler can emit a finite sequence of counters:

```typescript
// src/progress.ts
"use server";

import { Effect, Schema, Stream } from "effect";
import { EFFRONT } from "./effront";

export const streamProgress = EFFRONT.ServerFn.make({
  input: Schema.Struct({ count: Schema.Finite }),
  handler: ({ count }) => Effect.succeed(Stream.range(1, count)),
});
```

A query must return one value.
A stream must return a `Stream` for every successful alternative, including `Stream.empty` when there is no value to emit.
Do not mix a plain value and a stream in the same Server Function result.

## Consume chunks {#client}

Wrap the imported Server Function with `stream` from `@effront/core/query`.
It returns an Effect `Stream` whose chunks have the handler's element type.

```tsx
"use client";

import { Stream } from "effect";
import { stream } from "@effront/core/query";
import { streamProgress } from "./progress";

const progress = stream(streamProgress);

export const accumulatedProgress = progress({ count: 3 }).pipe(
  Stream.scan([], (values, value) => [...values, value]),
);
```

Use the Stream and Effect APIs selected by the component to run, collect, or render the chunks.
`streamAtom` creates an optional atom result function when a component needs the latest streamed chunk through Effect Reactivity.
It requires the persistent `RegistryProvider` setup from [Query Server Functions](./query-server-functions.md#atom-setup), but `stream` itself does not.
Before the first chunk, its error channel can also contain Effect's `Cause.NoSuchElementError`; handle the empty-yet state in the component.

## Failures, cancellation, and lifetime {#lifetime}

Stream calls use the same `ServerFnError` union as Query Server Functions: `ServerFnInputError`, `ServerFnDefect`, and `ServerFnTransportError`.
Handle them in the Stream or Effect error channel and do not expose a defect stack or detail as a user-facing error.

When the client stops consuming, replaces a stream, or interrupts its Effect, Effront aborts the corresponding request.
The server stream is request-scoped, not application-scoped.
Resources acquired for it stay available through streaming and are released after the response completes, fails, or is cancelled.
On cancellation, Effront interrupts and joins the stream producer so its asynchronous finalizers complete before the request scope releases.
Write finalizers and I/O so that they cooperate with cancellation.
Core protocol tests and Node development and production browser tests cover streaming and cancellation.
Validate behavior and disconnect propagation separately on any other host in its actual environment.

## Choose query, stream, or mutation {#choose}

| Need                                                         | Use                                 |
| ------------------------------------------------------------ | ----------------------------------- |
| Read one value without route refresh                         | `query` or `queryAtom`              |
| Read progressive values without route refresh                | `stream` or `streamAtom`            |
| Submit a form or update state with normal navigation refresh | A standard Server Function mutation |

The public contract is the API exported from `@effront/core/query`.
Do not rely on an internal query URL, HTTP method, or a particular transport implementation.

## Design provenance {#provenance}

Effront's stream design is a selective Vite adaptation informed by upstream effective-rsc commits [bcd3d255](https://github.com/nikhilsnayak/effective-rsc/commit/bcd3d255), [2df9211a](https://github.com/nikhilsnayak/effective-rsc/commit/2df9211a), and [91fa61ea](https://github.com/nikhilsnayak/effective-rsc/commit/91fa61ea).
Those changes include upstream stream completion handling, but they do not define Effront's host protocol or lifetime model.
Effront Vite hosts retain request resources only for the active response rather than making stream resources application-lifetime services.
