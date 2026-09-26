Query Server Function は、Client Component からサーバーのデータを読み取るために使います。
呼び出しを mutation として扱わず、現在のルートも再描画しません。
既存の Server Function を Effect 対応のクライアント API から実行します。
状態を変更し、UI のナビゲーションまたは更新が必要なときは、通常の Server Function またはフォームの action を使います。

## クエリを呼び出す {#call}

先頭が `"use server"` のモジュールから、読み取り専用の Server Function を export します。
入力の Schema はサーバー側の信頼境界であり続けます。

```typescript
// src/ticket.ts
"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";

export const lookupTicket = EFFRONT.ServerFn.make({
  input: Schema.Struct({ ticketCode: Schema.NonEmptyString }),
  handler: ({ ticketCode }) => Effect.succeed({ ticketCode, status: "checked-in" as const }),
});
```

Client Component では、import した Server Function を `query` で包みます。
返される関数は同じ位置引数を受け取り、`Effect` を返します。

```tsx
"use client";

import { Effect } from "effect";
import { query } from "@effront/core/query";
import { lookupTicket } from "./ticket";

const lookup = query(lookupTicket);

export function TicketStatus({ ticketCode }: { ticketCode: string }) {
  const onCheck = () => void Effect.runPromiseExit(lookup({ ticketCode }));
  return <button onClick={onCheck}>Check ticket</button>;
}
```

`query(lookupTicket)` の Effect の結果型は `Effect<Output, ServerFnError>` です。
クエリが成功すると、Flight の応答が完全に終了してリクエストのリソースが解放された後に値を返します。通常の Server Function のルート更新は要求しません。
そのため、遅れて起きた転送失敗も成功したクエリ結果にはならず、`ServerFnTransportError` になります。
通常の mutation 更新に UI が依存する書き込みには使わないでください。

## リアクティブな結果を保持する {#atom}

`queryAtom` は、同じ Server Function 用の `AtomResultFn` を作ります。
Effect Reactivity の atom がコンポーネントの読み込み中、成功、失敗の状態に適している場合に使います。

```tsx
"use client";

import { queryAtom } from "@effront/core/query";
import { lookupTicket } from "./ticket";

export const ticketStatus = queryAtom(lookupTicket);
// コンポーネントで使う Effect Reactivity API を通じて ticketStatus({ ticketCode }) を読み取ります。
```

atom は元の Server Function と同じ引数を受け取ります。
フレームワーク内部のキャンセル用マーカーはエンコードされる入力に含まれないため、サーバーが受け取るのは引き続き `{ ticketCode }` だけです。

## 任意の atom 統合をセットアップする {#atom-setup}

`query` に atom registry は必要ありません。
`queryAtom` は、アプリケーションが Effect Reactivity を使う場合だけ利用します。
その場合は、アプリケーションの Effect 4 リリースと互換性のある [`@effect/atom-react`](https://www.npmjs.com/package/@effect/atom-react) をインストールします。

```sh
npm install @effect/atom-react
```

`RegistryProvider` は、ナビゲーションで置き換わる Page ではなく、アプリケーションの永続的な Root Layout に配置します。
これにより、ページ遷移をまたいで atom の結果が一つのアプリケーション所有 registry を使えます。

```tsx
import { RegistryProvider } from "@effect/atom-react";
import { Effect } from "effect";
import { EFFRONT } from "./effront";

export const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) => Effect.succeed(<RegistryProvider>{children}</RegistryProvider>),
});
```

`ticketStatus({ ticketCode })` はこの provider の下で、コンポーネントが選ぶ `@effect/atom-react` の API から読み取ります。

## 型付きの失敗を扱う {#errors}

クエリは `@effront/core/query` から export される `ServerFnError` を、Effect のエラーチャネルで返します。

| エラー                   | 意味                                                     | 利用できるフィールド                            |
| ------------------------ | -------------------------------------------------------- | ----------------------------------------------- |
| `ServerFnInputError`     | Server Function の入力をデコードまたは検証できなかった。 | `detail.name`、`detail.message`                 |
| `ServerFnDefect`         | ハンドラーで予期しない失敗が起きた。                     | `digest`、任意の `detail`                       |
| `ServerFnTransportError` | ブラウザーがクエリの転送を完了できなかった。             | `detail.name`、`detail.message`、`detail.stack` |

既知のタグは Effect のエラー演算子で扱い、安全な利用者向けメッセージを表示します。
defect の詳細や stack をそのまま表示しないでください。
すでにチェックイン済みのチケットのような想定内の業務上の結果は、ハンドラーから成功したタグ付きの値として返す方が通常は明確です。
そのようにすれば、無効な入力、defect、転送失敗と区別できます。

## キャンセルとリクエストの生存期間 {#cancellation}

`query` が返す Effect を中断すると、ブラウザーのリクエストは `AbortSignal` を通じて中止されます。
ハンドラーと依存する I/O はキャンセルを尊重するように記述してください。

サーバーでは、クエリはリクエストスコープで実行されます。
そのリクエストで取得したリソースは、応答が有効な間だけ使え、応答の完了、失敗、キャンセル時に解放されます。
Query をアプリケーション全体のサービスを生かしておく方法として使わないでください。

## 設計の来歴 {#provenance}

Effront の Query Server Function 設計は、上流 effective-rsc のコミット [bcd3d255](https://github.com/nikhilsnayak/effective-rsc/commit/bcd3d255)、[2df9211a](https://github.com/nikhilsnayak/effective-rsc/commit/2df9211a)、[91fa61ea](https://github.com/nikhilsnayak/effective-rsc/commit/91fa61ea) を参考に選択的に Vite へ適応したものです。
Effront の公開契約は `@effront/core/query` から export される API です。
Effront の Vite ホストはリクエストスコープの統合を使うため、上流のエンドポイントパス、HTTP メソッド、起動スコープの生存期間を前提にしないでください。
