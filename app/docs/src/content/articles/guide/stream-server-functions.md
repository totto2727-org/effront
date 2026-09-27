Stream Server Function は、サーバーで連続した値を読み取り、Client Component で各値が届くたびに表示するときに使います。
書き込み後に現在のルートをナビゲーションまたは更新する場合は、通常の mutation を使います。

## フィードをストリーミングする {#feed}

読み取り専用の Server Function から Effect の `Stream` を返します。
何も送らない場合の `Stream.empty` を含め、成功するすべての分岐で `Stream` を返す必要があります。

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

## 到着したストーリーを表示する {#render}

import した Server Function を `stream` で包み、ストーリーごとにコンポーネントの状態を更新します。

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
          ストーリーを読み込めませんでした。{" "}
          <button onClick={() => setAttempt((value) => value + 1)}>再試行</button>
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

Effect Reactivity で最新のチャンクだけを使う場合は `streamAtom` を使います。これは [`queryAtom`](./query-server-functions.md#atom-setup) と同じ任意の `RegistryProvider` セットアップを使います。
想定内の結果と実行時の失敗は、[Server Function のエラーハンドリング](../best-practices/server-function-error-handling.md)を参照してください。
完全な[ストリーミングフィードのサンプル](https://github.com/totto2727-org/effront/tree/main/examples/streaming-feed)では、段階的なページ表示とクライアント側の再試行を確認できます。
