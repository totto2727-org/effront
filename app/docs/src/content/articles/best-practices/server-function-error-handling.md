Server Function には二種類のエラーハンドリングがあります。想定内の業務上の結果はデータとして返し、無効な入力や実行時の失敗はクライアント境界で扱います。
これは Mutation、Query、Stream の呼び出しに共通です。

## 想定内の結果をデータとして返す {#expected}

予約済みの名前のように想定内の結果は、ハンドラーからタグ付きの成功値として返します。
Mutation の呼び出し側は `useActionState` でその値を表示でき、Query と Stream の呼び出し側は通常の結果と同じように表示できます。

```typescript
// src/greet.ts
"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";

export const greet = EFFRONT.ServerFn.make({
  input: Schema.Struct({ name: Schema.NonEmptyString }),
  handler: ({ name }) =>
    Effect.succeed(
      name === "Admin"
        ? { _tag: "ReservedName" as const }
        : { _tag: "Greeting" as const, message: `Hello, ${name}.` },
    ),
});
```

こうすると、想定内の結果を入力検証や予期しない失敗と区別できます。

## 安全な失敗メッセージを表示する {#operational}

`query` と `stream` は、クライアント側の実行時の失敗を `@effront/core/query` の `ServerFnError` として Effect のエラーチャネルで返します。

| エラー                   | 意味                                       | 利用者に表示する内容               |
| ------------------------ | ------------------------------------------ | ---------------------------------- |
| `ServerFnInputError`     | 入力をデコードまたは検証できなかった。     | 入力が不正である説明。             |
| `ServerFnDefect`         | ハンドラーで予期しない失敗が起きた。       | 再試行を促す一般的なメッセージ。   |
| `ServerFnTransportError` | ブラウザーがリクエストを完了できなかった。 | 接続と再試行を案内するメッセージ。 |

既知のタグを扱い、defect の `detail` や stack を表示しないでください。
次の例は [Query ガイドの `lookupTicket`](../guide/query-server-functions.md#call)を利用します。

```tsx
// src/ticket-message.ts
"use client";

import { query } from "@effront/core/query";
import { Effect } from "effect";
import { lookupTicket } from "./ticket";

const lookupMessage = (ticketCode: string) =>
  query(lookupTicket)({ ticketCode }).pipe(
    Effect.map(({ status }) => status),
    Effect.catchTags({
      ServerFnInputError: () => Effect.succeed("チケット番号が無効です。"),
      ServerFnDefect: () => Effect.succeed("確認に失敗しました。"),
      ServerFnTransportError: () => Effect.succeed("通信できません。再試行してください。"),
    }),
  );
```

Mutation では Schema のデコードと予期しないハンドラーの失敗は、`useActionState` の state を更新するのではなく action の失敗になります。周辺のエラー UI は React の [useActionState リファレンス](https://react.dev/reference/react/useActionState)を参考に選びます。
