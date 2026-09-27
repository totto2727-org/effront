Query Server Function は、現在のルートを更新せずに Client Component からサーバーの値を一つ読み取るために使います。
状態を変更し、UI のナビゲーションまたは更新が必要なときは、通常の Server Function またはフォームの action を使います。

## クエリを呼び出す {#call}

先頭が `"use server"` のモジュールから読み取り専用の Server Function を export し、クライアント側の import を `query` で包みます。
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

```tsx
// src/ticket-status.tsx
"use client";

import { Effect } from "effect";
import { query } from "@effront/core/query";
import { useState } from "react";
import { lookupTicket } from "./ticket";

const lookup = query(lookupTicket);

export function TicketStatus({ ticketCode }: { ticketCode: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const onCheck = () => {
    void Effect.runPromise(lookup({ ticketCode }))
      .then(({ status }) => setStatus(status))
      .catch(() => setStatus("チケットを確認できませんでした。"));
  };
  return (
    <>
      <button onClick={onCheck}>確認する</button>
      <p aria-live="polite">{status}</p>
    </>
  );
}
```

`query(lookupTicket)` は Server Function と同じ引数を受け取り、通常の Server Function のルート更新を要求しない `Effect` を返します。
想定内の結果と実行時の失敗は、[Server Function のエラーハンドリング](../best-practices/server-function-error-handling.md)を参照してください。

## リアクティブな結果を保持する {#atom}

コンポーネントの読み込み中、成功、失敗を Effect Reactivity の atom で扱う場合は `queryAtom` を使います。

```tsx
"use client";

import { queryAtom } from "@effront/core/query";
import { useAtom } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import { useEffect } from "react";
import { lookupTicket } from "./ticket";

const ticketStatus = queryAtom(lookupTicket);

export function TicketStatusAtom({ ticketCode }: { ticketCode: string }) {
  const [result, run] = useAtom(ticketStatus);
  useEffect(() => {
    run([{ ticketCode }]);
  }, [ticketCode, run]);

  if (AsyncResult.isInitial(result)) return <p>読み込み中…</p>;
  if (AsyncResult.isFailure(result)) return <p role="alert">確認できませんでした。</p>;
  return <p>{result.value.status}</p>;
}
```

## 任意の atom 統合をセットアップする {#atom-setup}

`query` に atom registry は必要ありません。
`queryAtom` は、アプリケーションが Effect Reactivity を使う場合だけ利用します。インストールと React への統合は、使用中の Effect 4 リリースに合わせて [`@effect/atom-react` の公式 README](https://github.com/Effect-TS/effect/blob/main/packages/atom/react/README.md#installation)を参照してください。
複数ページで atom の状態を共有する場合、`RegistryProvider` はナビゲーションで置き換わらないクライアント境界に配置します。単一ページの[チェックインサンプル](https://github.com/totto2727-org/effront/blob/main/examples/check-in/src/features/check-in/client.tsx)では、そのページの Client Component 内に配置しています。
上の `TicketStatusAtom` はその provider の下で使用します。
