Effront の Middleware は、ページのリクエストや Server Function の呼び出しに対して、事前のチェックやリクエスト固有のサービスの提供を行います。
認証の確認や、アプリケーションから現在のユーザーを参照できるようにする処理などを共通化できます。

[はじめにのサンプル](./getting-started.md)を [http://127.0.0.1:1340](http://127.0.0.1:1340) で起動した状態で進めます。

## 適用するリクエストを選ぶ {#reach}

ページへのリクエストには Routes に、Server Function の呼び出しにはその関数を作る定義に Middleware を付けます。
保護されたページに表示しただけでは、アクションは保護されません。

独自の HTTP エンドポイントや、ルートに一致しないリクエストにも適用する場合は、[グローバル HTTP Middleware](/guide/http#global) を使います。
ホストが直接配信する静的アセットには、ホスト側の設定が必要です。

## リクエストのサービスを提供する {#view}

`src/request-scope.ts` を作り、現在のリクエスト URL をサービスとして提供します。

```typescript
import { Context, Effect } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { Application } from "@effront/core";

export class RequestInfo extends Context.Service<RequestInfo, { readonly url: string }>()(
  "app/middleware/RequestInfo",
) {}

export const EFFRONT = Application.effront();

const WithRequestInfo = EFFRONT.Middleware.make<{ provides: RequestInfo }>(
  Effect.fn(function* (httpEffect) {
    const request = yield* HttpServerRequest.HttpServerRequest;
    return yield* httpEffect.pipe(Effect.provideService(RequestInfo, { url: request.url }));
  }),
);

export const RequestEFFRONT = EFFRONT.withMiddleware(WithRequestInfo);
```

`provides: RequestInfo` でサービスを宣言し、`Effect.provideService` で後続の処理に値を提供します。
リクエストを続行するには `httpEffect` を実行します。
このスコープの利用側と Routes は、派生した `RequestEFFRONT` から定義します。

## Page にサービスを適用する {#routes}

`src/entry.effront.tsx` を作成します。

```tsx
import { Effect } from "effect";
import { EFFRONT, RequestEFFRONT, RequestInfo } from "./request-scope";

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="en">
        <body>{children}</body>
      </html>,
    ),
});

const RequestPage = RequestEFFRONT.Page.make({
  render: Effect.fn("RequestPage.render")(function* () {
    const info = yield* RequestInfo;
    return <p>Request URL: {info.url}</p>;
  }),
});

const routes = RequestEFFRONT.Routes.make({ layout: RootLayout }).page("/request", RequestPage);

export default EFFRONT.make({ routes });
```

[http://127.0.0.1:1340/request](http://127.0.0.1:1340/request) を開くと、リクエスト URL が表示されます。
`RequestEFFRONT` から Page を作るだけでは不十分で、Routes でも Middleware を有効にする必要があります。
`RequestEFFRONT` から作った Layout と Component も、このスコープ内で描画される場合にサービスを読み取れます。
一つのセクションに限定するには、この Routes を親 Routes に mount します。

## 後続の処理を止めて応答する {#order}

後続の処理を止めるには、`httpEffect` を実行せずにレスポンスを返します。
例えば、`src/maintenance.ts` を作成します。

```typescript
import { Effect } from "effect";
import { HttpServerResponse } from "effect/unstable/http";
import { EFFRONT } from "./request-scope";

export const Maintenance = EFFRONT.Middleware.make(() =>
  Effect.succeed(HttpServerResponse.text("Under maintenance", { status: 503 })),
);
```

エントリーで `Maintenance` を import し、`RequestEFFRONT.Routes.make(...)` を `RequestEFFRONT.withMiddleware(Maintenance).Routes.make(...)` に置き換えます。
Page の代わりに、ステータス 503 と `Under maintenance` が返ります。
条件付きのチェックでは、リクエストを許可する場合にだけ `httpEffect` を実行してください。

認証も同じ流れです。
セッションを検証し、不正なリクエストを拒否し、続行前に検証済みの利用者を提供します。
cookie やヘッダーに入ったユーザー名は、本人である証明にはなりません。

Middleware は宣言順に入り、レスポンスは逆順に処理します。
途中で応答すると、残りの内側のハンドラーは実行されません。
一つのチェーンに同じ Middleware を二度追加しないでください。

## Server Function にチェックを適用する {#actions}

`src/record-request.ts` で、Middleware 付きの `RequestEFFRONT` からアクションを定義します。

```typescript
"use server";

import { Effect, Schema } from "effect";
import { RequestEFFRONT, RequestInfo } from "./request-scope";

export const recordRequest = RequestEFFRONT.ServerFn.make({
  input: Schema.fromFormData(Schema.Struct({})),
  handler: Effect.fn("recordRequest")(function* () {
    const info = yield* RequestInfo;
    yield* Effect.logInfo("Form received", { url: info.url });
  }),
});
```

Routes を `Maintenance` なしの定義に戻し、Page のモジュールで `recordRequest` を import して、返す JSX に次のフォームを追加します。

```tsx
<form action={recordRequest}>
  <button type="submit">Record request</button>
</form>
```

送信すると、`Form received` と送信時の URL がログに出ます。
ページを開いたときの値を保存して使うわけではありません。
この Middleware はデータを提供するだけです。
保護が必要な更新には、Server Function の定義に実際の認証と認可のチェックを付けてください。
フォームの状態を返す方法は [Server Functions](/guide/server-functions) を参照してください。
