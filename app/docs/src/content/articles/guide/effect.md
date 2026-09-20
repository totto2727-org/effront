`Application.effront<Services>()` でアプリケーションサービスを宣言し、`EFFRONT.make({ layer })` で実装を提供します。

## Page でサービスを使う {#service}

`src/greeting.ts` を作成します。

```typescript
import { Context, Effect, Layer } from "effect";

export class Greeting extends Context.Service<
  Greeting,
  { readonly message: (name: string) => Effect.Effect<string> }
>()("app/services/Greeting") {
  static readonly layer = Layer.succeed(Greeting, {
    message: (name) => Effect.succeed(`Hello, ${name}.`),
  });
}
```

`src/entry.effront.tsx` で `Greeting` を宣言し、Page から読み取り、その Layer を提供します。

```tsx
import { Effect } from "effect";
import { Application } from "@effront/core";
import { Greeting } from "./greeting";

const EFFRONT = Application.effront<Greeting>();

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="en">
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

export default EFFRONT.make({ routes, layer: Greeting.layer });
```

`/` を開くと `Hello, Ada.` と表示されます。
実装を差し替えるには、Page を変えずに、`Greeting` を提供する別の Layer を渡します。

## サービスのスコープを選ぶ {#lifetime}

同じ `EFFRONT` から作った Page、Layout、Component、Server Function は、アプリケーションサービスを利用できます。
複数のサービスを使う場合は、`Application.effront<ServiceA | ServiceB>()` のように union 型で宣言し、両方を提供する Layer を渡します。
組み合わせ方は Effect の [Services](https://effect.website/docs/requirements-management/services/) と [Layers](https://effect.website/docs/requirements-management/layers/) を参照してください。

Effront はリクエストごとにアプリケーションの Layer を構築します。
スコープ内で確保したリソースは、Page が JSX を返した時点ではなく、レスポンス本文の読み取り完了、失敗、キャンセルまで利用できます。
リクエスト固有のサービスインスタンスをモジュール変数にキャッシュしないでください。

特定のルートやアクションだけで使うサービスには [Middleware](/guide/middleware) を使います。
Page の定義に加えて、Routes にもその Middleware を適用してください。

## サービス不足の型エラーを直す {#missing-services}

| エラーの箇所     | 確認すること                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Page の `render` | `Application.effront<Services>()` でサービスを宣言するか、Middleware 付きの定義を使います。 |
| `EFFRONT.make`   | アプリケーションサービスを宣言した場合は `layer` を渡します。                               |
| 渡した Layer     | 宣言したサービスをすべて提供します。`Layer.empty` は `Greeting` を提供できません。          |

Middleware が提供するサービスの場合は、型エラーを消すためにアプリケーション全体の実装を追加せず、有効なスコープを確認してください。
