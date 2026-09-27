Stream Server Function は、サーバーで連続した値を読み取り、Client Component で各値が届くたびに表示するときに使います。
書き込み後に現在のルートをナビゲーションまたは更新する場合は、通常の mutation を使います。

## ストリームを返す {#server}

Stream Server Function は通常と同じ入力検証を行い、ハンドラーから Effect の `Stream` を返します。
たとえば、有限のカウンター列を発行できます。

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

query は値を一つだけ返します。
stream は値がない場合の `Stream.empty` を含め、成功するすべての分岐で `Stream` を返す必要があります。
同じ Server Function の結果で、通常の値と stream を混在させないでください。

## チャンクを消費する {#client}

import した Server Function を、`@effront/core/query` の `stream` で包みます。
返される Effect の `Stream` は、ハンドラーの要素型のチャンクを発行します。

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
      {failed && <p role="alert">進捗を取得できませんでした。</p>}
      <ol>
        {values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ol>
    </section>
  );
}
```

各値の到着時にリストが更新され、コンポーネントが外れると通信とサーバー側の処理を中断します。
Effect Reactivity から最新のチャンクを使う場合は、`streamAtom` で任意の atom result function を作成します。
これには [Query Server Function](./query-server-functions.md#atom-setup) の `RegistryProvider` のセットアップが必要ですが、`stream` 自体には不要です。

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

  if (AsyncResult.isInitial(result)) return <p>最初のチャンクを待機中…</p>;
  if (AsyncResult.isFailure(result)) return <p role="alert">進捗を取得できませんでした。</p>;
  return <output>{result.value}</output>;
}
```

`LatestProgress` は `RegistryProvider` の下で描画します。`streamAtom` は最新値を保持するため、全チャンクを蓄積して表示する場合は上の `Stream.runForEach` の例を使います。
最初のチャンクより前では、エラーチャネルに Effect の `Cause.NoSuchElementError` も含まれます。コンポーネントでは、まだ値がない状態を扱ってください。

## 失敗、キャンセル、生存期間 {#lifetime}

Stream 呼び出しは Query Server Function と同じ `ServerFnError` の共用体を使います。
すなわち `ServerFnInputError`、`ServerFnDefect`、`ServerFnTransportError` です。
Stream または Effect のエラーチャネルで扱い、defect の stack や detail を利用者向けのエラーとして出さないでください。

クライアントが消費を止める、stream を置き換える、または Effect を中断すると、Effront は対応するリクエストを中止します。
サーバーの stream はアプリケーションスコープではなくリクエストスコープです。
取得したリソースはストリーミング中だけ利用でき、応答の完了、失敗、キャンセル後に解放されます。
キャンセル時には、Effront が stream producer を中断して join するため、非同期 finalizer もリクエストスコープを解放する前に完了します。
finalizer と I/O はキャンセルに協調するように記述してください。
[ストリーミングフィードの Node サンプル](https://github.com/totto2727-org/effront/tree/main/examples/streaming-feed)を実行すると、ページ単位の段階的な表示、失敗時の再試行、中断を確認できます。[開発・本番ブラウザーテスト](https://github.com/totto2727-org/effront/tree/main/tests/e2e-streaming-feed)では、それらと JavaScript 無効時の初期表示を検証しています。
ほかのホストへの展開時は、そのホストでも切断時の中断伝播を確認してください。

公開契約は `@effront/core/query` から export される API です。
内部の query URL、HTTP メソッド、特定の転送実装には依存しないでください。
