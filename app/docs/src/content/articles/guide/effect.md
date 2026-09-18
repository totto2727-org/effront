アプリケーションが要求するサービス union を `Application.effront<Services>()` に指定します。サービスを要求するなら `EFFRONT.make` の `layer` が必須です。

## 型付きサービスと Layer {#service}

サービス自身の設計は [Effect Services](https://effect.website/docs/requirements-management/services/) と [Layers documentation](https://effect.website/docs/requirements-management/layers/) を参照してください。 Effront 固有の接続点は、`Application.effront<Services>()` と`EFFRONT.make` の `layer` です。

`src/greeting.ts` にサービスの契約と実装を定義します。

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

`src/entry.effront.tsx` で要求を宣言し、同じ境界で Layer を提供します。

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

## サービス不足の型エラー {#missing-services}

要求するサービスの宣言と、Layer による提供は型チェックで確認されます。 上の Greeting を例にすると、次の不足を検出します。診断の全文は呼び出し方により変わります。

- `Application.effront()` のまま Page の render で Greeting を要求すると、`TS2769: No overload matches this call` になります。 render が返す Effect の要求サービス Greeting が、利用可能なサービスに含まれないためです。`Application.effront<Greeting>()` と宣言します。

- Greeting を宣言して `EFFRONT.make` の layer を省略すると、`TS2345` になります。渡したオブジェクトに必須の layer が不足しています。

- `layer: Layer.empty` を渡すと、`TS2322: Type 'Layer<never, never, never>' is not assignable to type 'Layer<Greeting, never, HttpRouter>'`になります。Layer の出力に Greeting が不足しているため、`Greeting.layer` を渡します。

複数サービスを宣言した場合は、それらをすべて提供する Layer を渡します。 Middleware 経由で追加するサービスは、その Middleware を適用したスコープで利用します。

## リクエストごとの生存期間 {#lifetime}

Fetch ランタイムはアプリケーション Layer をグローバルに一度だけ構築しません。各 request で取得し、Response body の EOF、エラー、キャンセルまで scope を保持します。リクエスト固有の接続や値をモジュールグローバルにキャッシュしないでください。

Middleware が提供するサービスは、その Middleware を追加した EFFRONT の Page、Layout、Component、Server Function で利用できます。認証のような依存関係を明示する用途に向きます。
