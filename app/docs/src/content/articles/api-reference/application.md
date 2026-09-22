`@effront/core` の `Application` は、ルートとサービス Layer をまとめ、配信を担うホストとは独立したアプリケーション定義を作ります。

## アプリケーション定義の例 {#example}

```tsx
import { Application } from "@effront/core";
import { Effect } from "effect";

const EFFRONT = Application.effront();
const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="en">
        <head>
          <title>Example</title>
        </head>
        <body>{children}</body>
      </html>,
    ),
});
const Home = EFFRONT.Page.make({
  render: () => Effect.succeed(<h1>Home</h1>),
});

export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/", Home),
});
```

この定義は `/` を `Home` に対応させますが、サーバーは起動しません。
[ホストアダプター](../platforms.md) が定義を受け取って配信します。

## Application.effront {#identity}

`Application.effront<Services = never>()` は実行時の引数を取らず、`EFFRONT` ファクトリーを返します。
`Services` はアプリケーション Layer が提供するサービスを宣言します。

定義を複数のモジュールに分ける場合は、共有するファクトリーを一つ公開します。

```typescript
import { Application } from "@effront/core";

export const EFFRONT = Application.effront();
```

サービスの型が同じでも、呼び出しごとに異なる ID が作られます。
異なる ID の Routes、Page、Layout、Loading、Middleware を混在させると `TypeError` が発生します。
ファクトリーには、[描画用ファクトリー](./components.md)、[Routes と Middleware](./routing.md)、[ServerFn](./server-functions.md) があります。

## EFFRONT.make {#make}

`EFFRONT.make({ routes, layer? })` は `ApplicationDefinition<Services, ApplicationError, Requirements>` を返します。

| オプション | 契約                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `routes`   | 同じ ID の Routes。ルート直下に Layout があり、ツリーに Page が一つ以上必要。子の Layout だけでは不十分。                                        |
| `layer`    | `Layer.Layer<Services, ApplicationError, HttpRouter.HttpRouter \| Requirements>`。`Services` が `never` でない限り必須。省略時は `Layer.empty`。 |

`ApplicationError` は Layer 構築時のエラー型です。
`Requirements` は外部サービスの要件を保持します。
HTTP ハンドラーが `HttpRouter.HttpRouter` を提供するため、`Services` が `never` でも Layer で独自 HTTP ルートを登録できます。

Layer の取得は `make` の呼び出し時ではなく、リクエストごとに行います。
ホストはレスポンス本文の完了、失敗、キャンセルまでリクエスト Scope を保持する必要があります。

[ネイティブ HTTP](./http.md) は、ホストが提供する外部サービスの要件を保持します。
[Workers Fetch](./workers.md) は、`HttpRouter` と `HttpServerRequest` で満たせる要件だけを受け付けます。
`makeHttpEffect` と [Alchemy アダプター](./alchemy.md) は、ホスト所有のサービス参照を捕捉できますが、サービスの寿命は延長しません。

## EFFRONT.withMiddleware {#middleware}

`EFFRONT.withMiddleware(middleware)` は、元と同じ ID と `make` 関数を持つ派生ファクトリーを返します。
元のファクトリーは変更しません。
派生ファクトリーでは、ミドルウェアが提供するサービスも利用できます。

| 派生ファクトリーで作る定義    | ミドルウェアの動作                                             |
| ----------------------------- | -------------------------------------------------------------- |
| `Routes`                      | ルートグループでミドルウェアを有効にする。                     |
| `Page`、`Layout`、`Component` | 有効なミドルウェアスコープを必要とする。自身では有効にしない。 |
| `ServerFn`                    | 呼び出し時に保持したミドルウェアチェーンを適用する。           |

ミドルウェアは同じ ID を持ち、その依存サービスがファクトリーから利用可能である必要があります。
別の ID のミドルウェアや、同じチェーンでの重複は `TypeError` になります。
ハンドラーの入力と実行順序は [Routes と Middleware](./routing.md) を参照してください。
