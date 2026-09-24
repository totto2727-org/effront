# Stream Server Function

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
"use client";

import { Stream } from "effect";
import { stream } from "@effront/core/query";
import { streamProgress } from "./progress";

const progress = stream(streamProgress);

export const accumulatedProgress = progress({ count: 3 }).pipe(
  Stream.scan([], (values, value) => [...values, value]),
);
```

コンポーネントに合わせて Stream と Effect の API を使い、チャンクを実行、収集、描画します。
Effect Reactivity から最新のチャンクを使う場合は、`streamAtom` で任意の atom result function を作成します。
これには [Query Server Function](./query-server-functions.md#atom-setup) の永続的な `RegistryProvider` のセットアップが必要ですが、`stream` 自体には不要です。
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
core のプロトコルテストと Node の開発・本番ブラウザーテストで、ストリーミングと中断を確認しています。
別のホストでの動作や切断伝播は、そのホストの実環境で別途検証してください。

## query、stream、mutation を選ぶ {#choose}

| 必要なこと                                                         | 使うもの                        |
| ------------------------------------------------------------------ | ------------------------------- |
| ルートを更新せずに値を一つ読む                                     | `query` または `queryAtom`      |
| ルートを更新せずに段階的な値を読む                                 | `stream` または `streamAtom`    |
| フォームを送信する、または通常のナビゲーション更新で状態を変更する | 通常の Server Function mutation |

公開契約は `@effront/core/query` から export される API です。
内部の query URL、HTTP メソッド、特定の転送実装には依存しないでください。

## 設計の来歴 {#provenance}

Effront の stream 設計は、上流 effective-rsc のコミット [bcd3d255](https://github.com/nikhilsnayak/effective-rsc/commit/bcd3d255)、[2df9211a](https://github.com/nikhilsnayak/effective-rsc/commit/2df9211a)、[91fa61ea](https://github.com/nikhilsnayak/effective-rsc/commit/91fa61ea) を参考に選択的に Vite へ適応したものです。
これらには上流の stream 完了処理も含まれますが、Effront のホストプロトコルや生存期間モデルを定義するものではありません。
Effront の Vite ホストは、stream のリソースをアプリケーション生存期間のサービスにせず、アクティブな応答に対してだけ保持します。
