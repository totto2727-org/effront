Middleware を使うと、ページやフォームのハンドラーで必要なリクエスト情報を用意できます。
ハンドラーが処理を始める前に、アクセスを許可するかどうかを確認する場所としても使えます。
リクエストに対して何を行うかと、アプリケーションのどの部分にその処理を適用するかを、それぞれ選べます。
以下では、現在の URL をサービスとして提供する例を作り、通常の処理をメンテナンス応答に置き換える方法と、フォーム送信への適用方法へ進みます。

## 対象のリクエストを選ぶ {#reach}

ページへのリクエストでは、対象の Routes に Middleware を適用します。
Server Function では、その関数を作る定義に Middleware を追加すると、呼び出し時に確認処理が実行されます。
この適用範囲をスコープと呼びます。
一つの Routes に Middleware を追加しても、アプリケーション全体の方針にはなりません。

ユーザー定義 HTTP のエンドポイントや、どのルートにも一致しないリクエストにも同じ処理が必要なら、その広い範囲には [HTTP のグローバル Middleware](/guide/http#global) を使います。
この登録が対象にするのは Effront の Fetch ハンドラー内のルーターであり、ホストが直接配信する静的アセットは含まれません。
そのアセットにも同じヘッダーやアクセス制限が必要な場合は、ホスト側で設定します。

## 後続の処理に渡すサービスを用意する {#view}

`src/request-scope.ts` を作り、利用側が読み取るサービスと、その値を提供する Middleware を定義します。
この例の `RequestInfo` は、現在の HTTP リクエストの URL を保持します。

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

ハンドラーが受け取る `httpEffect` は、Middleware が包む後続の処理です。
この Effect を実行するとリクエストの処理が続き、`Effect.provideService` によって後続から URL を `RequestInfo` として利用できます。
`provides: RequestInfo` という型の宣言は、派生した定義が利用できるサービスを伝えますが、それだけでは値を提供しません。
この宣言と `Effect.provideService` の呼び出しをそろえて実装してください。

`EFFRONT.withMiddleware(WithRequestInfo)` は、同じアプリケーションに属し、Middleware とサービスが追加された定義 `RequestEFFRONT` を返します。
この処理が必要な利用側の定義と Routes は、`RequestEFFRONT` から作ります。

## サービスの値をページに表示する {#routes}

`src/entry.effront.tsx` で `RequestInfo` を読み取る Page を作り、`RequestEFFRONT.Routes.make` を使って登録します。

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

`/request` を開くと、「アクセス先:」に続いて現在のリクエストの URL が表示されます。
値を用意するのは Middleware であり、Page はその値を読み取って表示するだけです。
`RequestEFFRONT` から作った Layout や Component も、この Routes の内側で描画されるときに同じサービスを読み取れます。

Page と Routes は組み合わせて設定してください。
`RequestEFFRONT` から Page を作っても、ベースの `EFFRONT.Routes` に登録すると Middleware は有効になりません。
大きなアプリケーションでは、Middleware を追加した Routes を親の Routes に `mount` することで、サイトの一部だけに処理を適用できます。

## ハンドラーの実行前にリクエストを止める {#order}

サービスを提供するハンドラーは、`httpEffect` を実行することで後続へ進みます。
後続の処理を実行させたくない場合は、代わりに HTTP 応答を返します。
たとえば、別の Middleware として次の `src/maintenance.ts` を用意します。

```typescript
import { Effect } from "effect";
import { HttpServerResponse } from "effect/unstable/http";
import { EFFRONT } from "./request-scope";

export const Maintenance = EFFRONT.Middleware.make(() =>
  Effect.succeed(HttpServerResponse.text("メンテナンス中です", { status: 503 })),
);
```

エントリーモジュールで `Maintenance` を import し、対象の Routes を `RequestEFFRONT.Routes.make(...)` の代わりに `RequestEFFRONT.withMiddleware(Maintenance).Routes.make(...)` から作ります。
その Routes へのリクエストには、ページの代わりにステータス 503 と「メンテナンス中です」が返ります。
この例では常に処理を止めます。
条件によって処理を分ける場合は、リクエストを許可する分岐だけで `httpEffect` を実行してください。

認証も同じ判断に沿って実装します。
セッションを検証し、失敗したら 401 などの応答を返し、成功したら検証済みの利用者をサービスとして提供してから後続へ進みます。
Cookie やヘッダーに書かれた利用者名は検証すべき入力であり、本人確認の証拠ではありません。

複数の確認処理が必要な場合、`EFFRONT.withMiddleware(first).withMiddleware(second)` は `first`、`second`、後続のハンドラーの順に入ります。
返された応答を処理するコードは、逆の順序で実行されます。
途中で応答を返すと残りの内側のハンドラーは実行されないため、確認したい順に Middleware を追加してください。
同じ Middleware を一つのチェーンに二度追加することはできません。

## フォーム送信にも処理を適用する {#actions}

フォームを表示するページが保護されていても、更新処理にはそのリクエストに対する確認が必要です。
Server Function が使うのは自身の定義に追加された Middleware であり、ページ上で使われるだけで保護されるわけではありません。
認証が必要な更新では、認証用の Middleware を含む定義から関数を作ってください。

メンテナンスの例を一時的に有効にした場合は、フォームを試す前に Routes の定義を元に戻してください。
送信時のサービス利用を試すには、`src/record-request.ts` を作り、`RequestEFFRONT` からハンドラーを定義します。

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

Page のモジュールで `recordRequest` を import し、描画結果に次のフォームを含めます。
この関数はフォームデータを受け取り、値を返さないため、`action` に直接渡せます。

```tsx
<form action={recordRequest}>
  <button type="submit">リクエストを記録</button>
</form>
```

フォームを送信し、サーバーログに「フォームを受信」と送信先の URL が記録されることを確認します。
Middleware が読み取るのは今回の呼び出しのリクエストであり、ページ表示時に保存した値ではありません。
この URL 用の Middleware はデータを提供するだけです。
保護された更新に同じパターンを使う前に、実際のアクセス確認処理を Server Function の定義へ追加してください。
