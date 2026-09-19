`@effront/core` の `Application` を使うと、ルートツリーとアプリケーションのサービスを、ホストで実行する一つのアプリケーション定義にまとめられます。
まず次の完全な例で構成を確認し、必要なオプションの確認やサービス・ミドルウェアの追加には、各 API の説明を参照してください。

## ルートが一つのアプリケーション {#example}

最小のアプリケーションには、Page と、ルートとなる Routes に指定した Layout が必要です。
次の定義は `/` を `Home` に対応付け、その内容を HTML ドキュメントで囲みます。

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

この default export はアプリケーション定義であり、起動済みのサーバーではありません。
ページを配信するには、利用する [プラットフォームのガイド](../platforms.md) に従ってホストへ接続します。
この例ではアプリケーションのサービスを宣言していないため、`layer` オプションは不要です。

## Application.effront: 共通のファクトリーを作る {#identity}

`Application.effront<Services = never>()` は実行時の引数を取らず、アプリケーションの定義に使うファクトリーを返します。
`Services` には `make` の `layer` オプションで提供するサービスの型を指定し、サービスがなければ既定値の `never` のままにします。

```typescript
import { Application } from "@effront/core";

const EFFRONT = Application.effront();
// サービスが必要な場合: Application.effront<MyService>()
```

この値を使って、[ページとレイアウト](./components.md)、[ルートとミドルウェア](./routing.md)、[サーバー関数](./server-functions.md) を定義します。
定義を複数のファイルに分ける場合は、`Application.effront()` を再び呼ぶのではなく、共有モジュールから `EFFRONT` を export して各ファイルで import してください。
呼び出しごとに新しい identity が作られるため、サービスの型が一致していても、別の呼び出しで作った値を同じものとして扱うことはできません。
異なる identity の Page・Routes・Layout・Loading・Middleware を組み合わせると `TypeError` になります。

## EFFRONT.make: ルートとサービスを渡す {#make}

配信するルートツリーができたら、`EFFRONT.make({ routes, layer? })` を呼びます。

| オプション | 必要な値                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| `routes`   | 同じ identity に属する Routes で、その値自体に `layout` が指定され、ツリー内に少なくとも一つの Page があるもの。 |
| `layer`    | `Services` を提供する Effect Layer で、`Services` が `never` の場合を除き必須です。                              |

ネストした Routes だけに Layout を指定しても、ルートの Layout の要件は満たせません。
`Services` が `never` の場合に `layer` を省略すると、`Layer.empty` が使われます。
この場合も Layer を渡すことはでき、たとえばアプリケーションのサービスを提供せずに独自の HTTP ルートを登録できます。

**Layer の依存関係。**
受け取る型は `Layer.Layer<Services, ApplicationError, HttpRouter.HttpRouter | Requirements>` です。
`Services` は Layer がアプリケーションへ提供するサービスであり、`Requirements` はその Layer を構築するために外部から提供する必要があるサービスです。
`ApplicationError` は構築時のエラー型です。
`effect/unstable/http` の `HttpRouter.HttpRouter` は HTTP ハンドラーから提供され、Layer はこれを使って HTTP ルートを登録できます。

**戻り値。**
`make` は `ApplicationDefinition<Services, ApplicationError, Requirements>` を返し、Layer のエラー型と外部サービスの要件をホストへの接続時にも保持します。
その要件を満たせる接続方法を選んでください。

- [native HTTP](./http.md) は外部要件を保持するため、ホストから必要なサービスを提供できます。
- [Workers の `createFetchHandler`](./workers.md) が受け取れるのは、Layer の要件を `HttpRouter.HttpRouter` と `HttpServerRequest.HttpServerRequest` で満たせるアプリケーションであり、任意の外部サービスを提供するわけではありません。
- ホストの構築時に利用できるサービスは、`makeHttpEffect` や [Alchemy 連携](./alchemy.md) で参照を捕捉し、ハンドラーから利用できます。

**サービスの寿命。**
アプリケーションの Layer は `make` の呼び出し時に一度だけ構築されるのではなく、リクエストごとに構築されます。
native HTTP ホストを自作する場合は、レスポンス body の完了・エラー・キャンセルまでリクエストのスコープを維持してください。
サービスの参照を捕捉しても寿命は延長されないため、その所有者は、そのサービスを使うすべてのレスポンス body の処理が終わるまでサービスを利用可能にしておく必要があります。

## EFFRONT.withMiddleware: 対象の定義にミドルウェアを追加する {#middleware}

`EFFRONT.withMiddleware(middleware)` を使うと、元の `EFFRONT` のファクトリーを変更せずに、ミドルウェアのスコープ用のファクトリーを派生させられます。
ミドルウェアを有効にするには、戻り値の `Routes.make()` ファクトリーでルートのグループを作ります。
派生ファクトリーで作った Page・Layout・Component は、そのスコープが有効になっている必要があり、自身でスコープを有効にするわけではありません。
派生ファクトリーで作った Server Function は、呼び出し時に自身のミドルウェアチェーンを適用します。
戻り値は元の identity と `make` 関数を共有するため、両方で作った定義を同じアプリケーションで使えます。

ミドルウェアは同じ identity に属し、追加先のファクトリーでは、そのミドルウェアが必要とするすべてのサービスを利用できる必要があります。
戻り値のファクトリーで作る定義では、ミドルウェアが提供するサービスも利用できます。
異なる identity のミドルウェアを追加した場合や、同じミドルウェアを同じスコープへ二度追加した場合は `TypeError` になります。
ミドルウェアの定義方法と配置の選択肢は、[Routes と Middleware](./routing.md) を参照してください。
