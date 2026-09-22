ページへのアクセスと Server Function の実行は、それぞれ独立して保護します。
フォームを表示する Page を開かなくても、Server Function は呼び出せます。

## 呼び出し口ごとにチェックを適用する {#entry-points}

保護された処理を始める前に、現在のリクエストを認証します。

| 呼び出し口              | 保護する処理                               | チェックの適用先                                    |
| ----------------------- | ------------------------------------------ | --------------------------------------------------- |
| Route（Page と Layout） | 保護されたデータの読み取りと表示           | Page を登録する Routes の Middleware。              |
| Server Function         | 独立して呼び出せる操作の実行               | 関数自体の Middleware またはハンドラー。            |
| カスタム HTTP API       | エンドポイント経由のデータの読み取りや変更 | HTTP ミドルウェアまたはエンドポイントのハンドラー。 |

カスタム HTTP エンドポイントには、[HTTP ミドルウェア](/ja/guide/http#global)を使います。

## 両方の登録で一つのポリシーを共有する {#shared-policy}

保護する Routes と Server Function に、同じミドルウェア派生ファクトリーを使います。
この例の `./auth` はアプリケーション側のモジュールであり、Effront の認証機能ではありません。
`checkEditorAccess` Effect は、現在のリクエストのセッションと編集権限を検証します。
このヘルパーは、アクセスを許可する場合に `undefined` を、失敗時に `401` や `403` などの HTTP 拒否レスポンスを返します。

`src/effront.ts` を作ります。

```typescript
import { Application } from "@effront/core";
import { Effect } from "effect";
import { checkEditorAccess } from "./auth";

export const EFFRONT = Application.effront();

const RequireEditor = EFFRONT.Middleware.make((next) =>
  Effect.fn("RequireEditor")(function* () {
    const rejection = yield* checkEditorAccess;
    if (rejection !== undefined) return rejection;
    return yield* next;
  })(),
);

export const EditorEFFRONT = EFFRONT.withMiddleware(RequireEditor);
```

同じファクトリーを使って `src/record-edit.ts` を作ります。

```typescript
"use server";

import { Effect, Schema } from "effect";
import { EditorEFFRONT } from "./effront";

export const recordEdit = EditorEFFRONT.ServerFn.make({
  input: Schema.fromFormData(Schema.Struct({})),
  handler: () => Effect.logInfo("Editor action accepted"),
});
```

`src/entry.effront.tsx` で、`EditorEFFRONT.Routes` を通して Page を登録します。

```tsx
import { Effect } from "effect";
import { EFFRONT, EditorEFFRONT } from "./effront";
import { recordEdit } from "./record-edit";

const EditorPage = EditorEFFRONT.Page.make({
  render: () =>
    Effect.succeed(
      <form action={recordEdit}>
        <button type="submit">Record edit</button>
      </form>,
    ),
});

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html>
        <body>{children}</body>
      </html>,
    ),
});

export default EFFRONT.make({
  routes: EditorEFFRONT.Routes.make({ layout: RootLayout }).page("/editor", EditorPage),
});
```

Routes の登録は、Page と Layout のレンダー前にアクセス権を確認します。
Server Function の登録にも同じポリシーが適用され、ハンドラーが受理した操作をログに記録する前にチェックします。
`EditorEFFRONT` から Page や Layout だけを作っても、ルートのミドルウェアは有効になりません。
リクエスト固有のサービスやネストしたスコープは、[Middleware ガイド](/ja/guide/middleware)を参照してください。

## 操作ごとに認可する {#authorization}

認証後に、確認済みのユーザーが対象レコードを読み取ったり変更したりできるかを確認します。
たとえば、プロジェクトの更新対象は、そのユーザーが編集できるプロジェクトに絞ります。
権限は、送信された所有者やロールではなく、サーバー側のデータから判断します。
Schema の検証とクライアント由来の状態については、[Server Function の入力契約](/ja/api-reference/server-functions#arguments)を参照してください。

次のリクエストを別々にテストします。

- 権限のないユーザーは、保護された Page を見られない。
- 同じユーザーが、その Server Function のリクエストを送信しても成功しない。
- 認証済みのユーザーが他人のレコード ID を送信しても、そのレコードを変更できない。
