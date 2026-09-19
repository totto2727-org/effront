アプリケーションサービスを使うと、サーバー側の処理が何に依存するかを明示しながら、その実装を一か所で選べます。
複数の Page で同じデータアクセスの契約を使いたい場合や、呼び出す側を書き換えずにテスト用の実装へ差し替えたい場合に役立ちます。
Effront では、アプリケーションが各処理で利用できるサービスを宣言し、Layer を通じてその実装を提供します。

以下の例では、挨拶を返すサービスを Page に接続します。
サービスの契約から画面への表示までを確認したあと、リクエストのスコープを保ちながら利用範囲を広げる方法を説明します。

## Page が使うサービスを接続する {#service}

まず、Page が必要とする操作を決めます。
ここでは、名前を受け取って挨拶を返す操作です。
この契約を `src/greeting.ts` の `Greeting` として定義し、`Greeting.layer` で簡単な実装を提供します。

```typescript
import { Context, Effect, Layer } from "effect";

export class Greeting extends Context.Service<
  Greeting,
  { readonly message: (name: string) => Effect.Effect<string> }
>()("app/services/Greeting") {
  static readonly layer = Layer.succeed(Greeting, {
    message: (name) => Effect.succeed(`こんにちは、${name} さん。`),
  });
}
```

`src/entry.effront.tsx` では、アプリケーション側で二つの設定を行ってサービスを接続します。
`Application.effront<Greeting>()` は、Page が `Greeting` に依存できることを宣言します。
`EFFRONT.make` の `layer` オプションは、提供する実装を選びます。
型を宣言するだけでは実行時にサービスが提供されないため、両方が必要です。

Page では `yield* Greeting` でサービスを取得し、その `message` メソッドを呼び出します。

```tsx
import { Effect } from "effect";
import { Application } from "@effront/core";
import { Greeting } from "./greeting";

const EFFRONT = Application.effront<Greeting>();

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="ja">
        <body>{children}</body>
      </html>,
    ),
});

const HomePage = EFFRONT.Page.make({
  render: Effect.fn("HomePage.render")(function* () {
    const greeting = yield* Greeting;
    const message = yield* greeting.message("Ada");
    return <h1>{message}</h1>;
  }),
});

const routes = EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage);

export default EFFRONT.make({
  routes,
  layer: Greeting.layer,
});
```

このアプリケーションの `/` を開くと、Ada への日本語の挨拶「こんにちは、Ada さん。」が表示されます。
Page は挨拶の取得方法を知っていますが、その実装を選択したり構築したりはしません。
実装を変えるには、同じ `Greeting` の契約を満たす別の Layer を `EFFRONT.make` に渡します。

## リクエストのスコープを保って利用範囲を広げる {#lifetime}

接続したサービスは、同じ EFFRONT から作った Layout、Component、Server Function でも利用できます。
別のアプリケーションサービスを追加するには、`Application.effront<ServiceA | ServiceB>()` のように union 型で宣言し、それらをすべて提供する Layer を渡します。
サービスの契約設計や Layer の組み合わせ方は、公式の [Effect Services](https://effect.website/docs/requirements-management/services/) と [Layers documentation](https://effect.website/docs/requirements-management/layers/) を参照してください。

これらの定義から使えるサービスであっても、サーバー全体で共有するサービスになるわけではありません。
アプリケーションの Layer は、サーバー起動時に一度だけではなく、リクエストごとに構築されます。
サービスがリクエストのスコープでリソースを確保する場合、そのリソースはレスポンス本文の読み取り完了、エラー、キャンセルまで利用できます。
Page が JSX を返したあともレスポンスのストリーミングが続くことがあるため、その時点で生存期間が終わるわけではありません。
リクエスト固有の接続や値をモジュールグローバルにキャッシュしないでください。

認証が必要なルートやアクションで使う認証済み利用者の情報など、アプリケーションの一部だけに必要な依存関係もあります。
そのようなサービスは [Middleware](/guide/middleware) で提供し、Middleware が有効なスコープで利用します。
Page の場合、Middleware 付きの EFFRONT から Page を作るだけではスコープが有効にならないため、リンク先の手順に従って Routes にも適用してください。

## サービスの接続に関する型エラーを解消する {#missing-services}

型チェックは、各処理が要求するサービスと、アプリケーションが宣言・提供するサービスを揃える助けになります。
挨拶の例で型エラーが出たら、呼び出す側から提供する側へ順に依存関係を確認します。

1. **`render` のエラーでは、サービスの宣言を確認します。**
   `Greeting` を使う Page には、そのサービスを利用できる EFFRONT が必要なので、`Application.effront()` ではなく `Application.effront<Greeting>()` を使います。
2. **`EFFRONT.make` のエラーでは、`layer` の省略を確認します。**
   アプリケーションサービスを宣言するとこのオプションが必須になるため、`layer: Greeting.layer` を渡します。
3. **渡した `layer` が拒否される場合は、提供するサービスを確認します。**
   `Layer.empty` は `Greeting` の要求を満たせず、一部のサービスだけを提供する Layer では、宣言したすべてのサービスの要求を満たせません。

Middleware から提供するサービスの場合は、エラーを消すためだけにアプリケーション全体の実装を追加せず、Middleware のスコープを確認してください。
