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
// src/progress-view.tsx
"use client";

import { stream } from "@effront/core/query";
import { Effect, Stream } from "effect";
import { useEffect, useState } from "react";
import { streamProgress } from "./progress";

const readProgress = stream(streamProgress);

export function ProgressView() {
  const [values, setValues] = useState<number[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void Effect.runPromise(
      Stream.runForEach(readProgress({ count: 3 }), (value) =>
        Effect.sync(() => setValues((current) => [...current, value])),
      ),
      { signal: controller.signal },
    ).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, []);

  return (
    <section>
      {failed && <p role="alert">Could not load progress.</p>}
      <ol>
        {values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ol>
    </section>
  );
}
```

Each value updates the list as it arrives, and unmounting the component interrupts the request and server work.
`streamAtom` creates an optional atom result function when a component needs the latest streamed chunk through Effect Reactivity.
It requires the `RegistryProvider` setup from [Query Server Functions](./query-server-functions.md#atom-setup), but `stream` itself does not.

```tsx
"use client";

import { streamAtom } from "@effront/core/query";
import { useAtom } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import { useEffect } from "react";
import { streamProgress } from "./progress";

const latestProgress = streamAtom(streamProgress);

export function LatestProgress() {
  const [result, run] = useAtom(latestProgress);
  useEffect(() => {
    run([{ count: 3 }]);
  }, [run]);

  if (AsyncResult.isInitial(result)) return <p>Waiting for the first chunk…</p>;
  if (AsyncResult.isFailure(result)) return <p role="alert">Could not load progress.</p>;
  return <output>{result.value}</output>;
}
```

Render `LatestProgress` below `RegistryProvider`. `streamAtom` retains the latest value; use the `Stream.runForEach` example above when the UI needs to accumulate every chunk.
Before the first chunk, its error channel can also contain Effect's `Cause.NoSuchElementError`; handle the empty-yet state in the component.

## Failures, cancellation, and lifetime {#lifetime}

Stream calls use the same `ServerFnError` union as Query Server Functions: `ServerFnInputError`, `ServerFnDefect`, and `ServerFnTransportError`.
Handle them in the Stream or Effect error channel and do not expose a defect stack or detail as a user-facing error.

When the client stops consuming, replaces a stream, or interrupts its Effect, Effront aborts the corresponding request.
The server stream is request-scoped, not application-scoped.
Resources acquired for it stay available through streaming and are released after the response completes, fails, or is cancelled.
On cancellation, Effront interrupts and joins the stream producer so its asynchronous finalizers complete before the request scope releases.
Write finalizers and I/O so that they cooperate with cancellation.
Run the [Node streaming-feed example](https://github.com/totto2727-org/effront/tree/main/examples/streaming-feed) to see incremental pages, retries, and cancellation. The [development and production browser tests](https://github.com/totto2727-org/effront/tree/main/tests/e2e-streaming-feed) also verify the initial render without JavaScript.
When deploying to another host, verify cancellation propagation on that host too.

The public contract is the API exported from `@effront/core/query`.
Do not rely on an internal query URL, HTTP method, or a particular transport implementation.
