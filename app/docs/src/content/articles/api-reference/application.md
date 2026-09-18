## Application.effront {#identity}

```typescript
import { Application } from "@effront/core";

const EFFRONT = Application.effront();
// サービスが必要な場合: Application.effront<MyService>()
```

`Application.effront<Services = never>()` は新しいアプリケーション identity を持つファクトリー集合を返します。`Services` はアプリケーション Layer が提供する Effect サービス型です。共有モジュールで一度作り、各定義から同じ値を読み込みます。

| API / 項目                            | 契約                                                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `Component / Page / Layout / Loading` | 同じ identity に属する描画定義を作ります。                                                                  |
| `Routes / Middleware / ServerFn`      | 同じ identity に属するルート・ミドルウェア・サーバー関数を作ります。                                        |
| `withMiddleware(middleware)`          | identity と make を共有し、ミドルウェアを追加した新しいファクトリー集合を返します。元の集合は変更しません。 |
| `make({ routes, layer? })`            | Fetch ハンドラーへ渡すアプリケーション定義を返します。サーバーの起動は行いません。                          |

別々の `Application.effront()` が返した値は、同じサービス型でも別 identity です。異なる identity の Page・Routes・Layout・Loading・Middleware を組み合わせると `TypeError` になります。

## make {#make}

| API / 項目 | 契約                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `routes`   | 同じ identity の空でない Routes。ルートの Routes 自身に layout が必要です。                                                                       |
| `layer`    | Layer.Layer&lt;Services, ApplicationError, HttpRouter.HttpRouter \| Requirements&gt;。Services が never なら省略でき、省略時は Layer.empty です。 |
| `戻り値`   | サービス型・Layer のエラー型・外部 Requirements を保持するアプリケーション定義。native HTTP へ接続すると外部要件がハンドラーにも残ります。        |

`HttpRouter.HttpRouter` は `effect/unstable/http` のサービスです。ハンドラーが提供する Router に対し、アプリケーション Layer から独自の HTTP ルートを登録できます。Layer は Fetch リクエストごとに構築されます。

`createFetchHandler` は Router と HttpServerRequest で満たせる要件の定義を受け取ります。
任意の外部サービスを Fetch が自動で提供するわけではありません。
追加の能力は [native HTTP](./http.md) の要件としてホストが提供するか、[Alchemy](./alchemy.md) の構築境界で捕捉してください。

## 最小定義 {#example}

```tsx
import { Effect } from "effect";
import { Application } from "@effront/core";

const EFFRONT = Application.effront();
const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="ja">
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
