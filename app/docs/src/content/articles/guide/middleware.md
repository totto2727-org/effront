Middleware は後続の HTTP Effect を受け取り、処理の前後を包みます。 リクエストから取り出した情報の提供や、認証済み利用者がいる場合だけ後続へ進める処理に使います。 サービスの型を追加する宣言と、実行時にサービスを提供する処理の両方が必要です。

## Middleware を持つ定義を派生させる {#view}

`src/request-scope.ts` では RequestInfo を提供します。 ベースの `EFFRONT.Middleware.make` から作り、`withMiddleware` で派生させます。 RequestEFFRONT は元と同じアプリケーションの identity を保ち、RequestInfo を利用可能なサービスに加えます。

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

## Routes でスコープを有効にする {#routes}

派生した定義から作った Routes が Middleware を有効にします。 Page、Layout、Component は、その有効なスコープの内側で render されるときに提供サービスを消費します。 Page だけを派生した定義から作り、ベースの Routes に置いてもスコープは有効になりません。 次の `src/entry.effront.tsx` はリクエストの URL を表示します。

```tsx
import { Effect } from "effect";
import { EFFRONT, RequestEFFRONT, RequestInfo } from "./request-scope";

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="ja">
        <body>{children}</body>
      </html>,
    ),
});

const RequestPage = RequestEFFRONT.Page.make({
  render: Effect.fn("RequestPage.render")(function* () {
    const info = yield* RequestInfo;
    return <p>アクセス先: {info.url}</p>;
  }),
});

const routes = RequestEFFRONT.Routes.make({ layout: RootLayout }).page("/request", RequestPage);

export default EFFRONT.make({ routes });
```

ネストする場合も派生した Routes を `mount` します。 Middleware が渡す RequestInfo はこのスコープのサービスなので、アプリケーションの layer から提供する必要はありません。

## Server Function でサービスを使う {#actions}

派生した定義から作った Server Function は、呼び出されたときに自身の Middleware スコープを有効にします。 Page の表示時だけでなく、更新時にも認証・認可を行うための接続点です。`src/record-request.ts` の void action はフォームへ直接渡せます。

```typescript
"use server";

import { Effect, Schema } from "effect";
import { RequestEFFRONT, RequestInfo } from "./request-scope";

export const recordRequest = RequestEFFRONT.ServerFn.make({
  input: Schema.fromFormData(Schema.Struct({})),
  handler: () =>
    Effect.gen(function* () {
      const info = yield* RequestInfo;
      yield* Effect.logInfo("フォームを受信", { url: info.url });
    }),
});
```

## 実行順序と応答の短絡 {#order}

`EFFRONT.withMiddleware(first).withMiddleware(second)` は first、second、後続処理の順で入り、応答は逆順に戻ります。 同じ Middleware を同じチェーンに二度追加することはできません。 次の例は後続を実行せず 503 を返す Middleware です。使う場合は Routes を作る定義に追加してください。

```typescript
import { Effect } from "effect";
import { HttpServerResponse } from "effect/unstable/http";
import { EFFRONT } from "./request-scope";

export const Maintenance = EFFRONT.Middleware.make(() =>
  Effect.succeed(HttpServerResponse.text("メンテナンス中です", { status: 503 })),
);
```

認証の場合は同じ分岐構造でセッションを検証し、失敗時は 401 などの応答を返し、成功時だけ検証済みの CurrentUser を後続へ提供します。 Cookie やヘッダーに書かれた利用者名を、そのまま本人確認の結果として扱わないでください。

## スコープと HTTP 全体の使い分け {#reach}

Effront のスコープ付き Middleware は、その Routes と Server Function を対象にします。 ユーザー定義 HTTP、静的アセット、どのルートにも一致しないリクエストには適用されません。 Fetch 内の HTTP 全体に共通ヘッダーなどを適用するには、[HTTP](/guide/http) で説明するネイティブのグローバル Middleware をアプリケーション Layer に登録します。
