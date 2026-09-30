Use a Stream Server Function when a server read produces a sequence and the Client Component should render each value as it arrives.
Use a standard mutation for writes that navigate or refresh the current route.

## Stream a feed {#feed}

Return an Effect `Stream` from a read-only Server Function.
Every successful branch must return a `Stream`, including `Stream.empty` when there is nothing to emit.

```typescript
// src/feed.ts
"use server";

import { Effect, Schema, Stream } from "effect";
import { EFFRONT } from "./effront";
import { storiesAfter } from "./feed-data";

export const streamFeed = EFFRONT.ServerFn.make({
  input: Schema.Struct({ after: Schema.Natural }),
  handler: ({ after }) =>
    Effect.succeed(
      Stream.fromIterable(storiesAfter(after)).pipe(
        Stream.mapEffect((story) => Effect.sleep(350).pipe(Effect.as(story))),
      ),
    ),
});
```

## Render arriving stories {#render}

Wrap the imported Server Function with `stream`, then update component state for every story.

```tsx
// src/feed-view.tsx
"use client";

import { stream } from "@effront/core/query";
import { Effect, Stream } from "effect";
import { useEffect, useState } from "react";
import { streamFeed } from "./feed";

const readFeed = stream(streamFeed);

export function FeedView() {
  const [stories, setStories] = useState<{ id: number; title: string }[]>([]);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStories([]);
    setFailed(false);
    void Effect.runPromise(
      Stream.runForEach(readFeed({ after: 0 }), (story) =>
        Effect.sync(() => setStories((current) => [...current, story])),
      ),
      { signal: controller.signal },
    ).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, [attempt]);

  return (
    <section>
      {failed && (
        <p role="alert">
          Could not load stories.{" "}
          <button onClick={() => setAttempt((value) => value + 1)}>Retry</button>
        </p>
      )}
      <ol>
        {stories.map((story) => (
          <li key={story.id}>{story.title}</li>
        ))}
      </ol>
    </section>
  );
}
```

Use `streamAtom` when the UI needs only the latest chunk through Effect Reactivity rather than a list of every story. It has the same optional `RegistryProvider` setup as [`queryAtom`](./query-server-functions.md#atom-setup). Render this component below that provider:

```tsx
// src/latest-story.tsx
"use client";

import { streamAtom } from "@effront/core/query";
import { useAtom } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import { useEffect } from "react";
import { streamFeed } from "./feed";

const latestStory = streamAtom(streamFeed);

export function LatestStory() {
  const [result, run] = useAtom(latestStory);
  useEffect(() => {
    run([{ after: 0 }]);
  }, [run]);

  if (AsyncResult.isInitial(result)) return <p>Waiting for a story…</p>;
  if (AsyncResult.isFailure(result)) return <p role="alert">Could not load a story.</p>;
  return <p aria-live="polite">Latest story: {result.value.title}</p>;
}
```

Each arriving story replaces the atom's value. Use the `stream` example above if the UI must retain all stories. An empty stream has no latest value and produces a failure result.
For expected outcomes and operational failures, use [Error handling for Server Functions](../best-practices/server-function-error-handling.md).
The complete [streaming-feed example](https://github.com/totto2727-org/effront/tree/main/examples/streaming-feed) includes progressive page rendering as well as client retries.
