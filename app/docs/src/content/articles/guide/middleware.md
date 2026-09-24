Effront の Middleware は、ページのリクエストや Server Function の呼び出しに対して、事前のチェックやリクエスト固有のサービスの提供を行います。
認証の確認や、アプリケーションから現在のユーザーを参照できるようにする処理などを共通化できます。

[はじめに](./getting-started.md)で見出しを `Hello, Effront` に変更し、開発サーバーに表示された URL でサンプルを起動した状態で進めます。

## 適用するリクエストを選ぶ {#reach}

Middleware を適用できる対象:

- ルート
- Server Function

共通の Middleware 適用済みアプリケーション定義から Routes と Server Function を作成すると、同じ Middleware をそれぞれに適用できます。

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

`src/entry.effront.tsx` で共有の定義を使い、ホームページを `/request` に置き換えます。

```tsx
// src/entry.effront.tsx: replace the Application import.
import { EFFRONT, RequestEFFRONT, RequestInfo } from "./request-scope";

// Remove the local EFFRONT declaration.
// Replace HomePage with RequestPage.
const RequestPage = RequestEFFRONT.Page.make({
  render: Effect.fn("RequestPage.render")(function* () {
    const info = yield* RequestInfo;
    return <p>Request URL: {info.url}</p>;
  }),
});

// Replace the default export with this route declaration and export.
const routes = RequestEFFRONT.Routes.make({ layout: RootLayout }).page("/request", RequestPage);

export default EFFRONT.make({ routes });
```

開発サーバーに表示された URL の `/request` を開くと、リクエスト URL が表示されます。
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

`src/entry.effront.tsx` で `Maintenance` を import し、Routes に適用します。

```tsx
// src/entry.effront.tsx: add to the imports.
import { Maintenance } from "./maintenance";

// Replace routes to apply Maintenance.
const routes = RequestEFFRONT.withMiddleware(Maintenance)
  .Routes.make({
    layout: RootLayout,
  })
  .page("/request", RequestPage);
```

Page の代わりに、ステータス 503 と `Under maintenance` が返ります。
条件付きのチェックでは、リクエストを許可する場合にだけ `httpEffect` を実行してください。

認証も同じ流れです。
セッションを検証し、不正なリクエストを拒否し、続行前に検証済みの利用者を提供します。

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

`src/entry.effront.tsx` で `Maintenance` を削除して Routes を元に戻し、`RequestPage` にフォームを追加します。

```tsx
// src/entry.effront.tsx: replace the Maintenance import.
import { recordRequest } from "./record-request";

// Replace RequestPage to include the form.
const RequestPage = RequestEFFRONT.Page.make({
  render: Effect.fn("RequestPage.render")(function* () {
    const info = yield* RequestInfo;
    return (
      <>
        <p>Request URL: {info.url}</p>
        <form action={recordRequest}>
          <button type="submit">Record request</button>
        </form>
      </>
    );
  }),
});

// Replace routes to remove Maintenance.
const routes = RequestEFFRONT.Routes.make({ layout: RootLayout }).page("/request", RequestPage);
```

送信すると、`Form received` と送信時の URL がログに出ます。
ページを開いたときの値を保存して使うわけではありません。

フォームの状態を返す方法は [Server Functions](/guide/server-functions) を参照してください。
