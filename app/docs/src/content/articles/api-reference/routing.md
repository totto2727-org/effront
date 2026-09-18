## Routes {#routes}

| API / 項目                           | 契約                                                                               |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| `Routes.make()`                      | layout と loading を持たない空の Routes を作ります。子ルートの組み立てに使えます。 |
| `Routes.make({ layout?, loading? })` | 同じ identity の Layout と Loading を設定します。                                  |
| `routes.page(path, page)`            | Page を追加した新しい Routes を返します。path と params の対応を型で検証します。   |
| `routes.mount(prefix, child)`        | 空でない子 Routes を静的 prefix の下に追加した新しい Routes を返します。           |

```typescript
const articles = EFFRONT.Routes.make().page("/", ArticleIndex).page("/:id", Article);
const routes = EFFRONT.Routes.make({ layout: RootLayout })
  .page("/", Home)
  .mount("/articles", articles);
```

各 Page と Layout は同じ EFFRONT で定義済みとします。子の `/` は `/articles` に、`/:id` は `/articles/:id` に対応します。`page` と `mount` は元の Routes を変更しません。

## パスの契約 {#paths}

| API / 項目           | 契約                                                                                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/ と /articles/:id` | 絶対パスのリテラルと、セグメント全体を占める :name パラメーターを使用します。                                                                                                      |
| `mount の prefix`    | パラメーターを含まない静的パスを指定します。                                                                                                                                       |
| `/manual/*path`      | 末尾の名前付き catch-all は任意階層を path に格納します。/manual と /manual/ では空文字です。Page の params Schema に同じ名前を定義します。捕捉値は一度だけ URL デコード済みです。 |
| `catch-all の競合`   | catch-all はその直下の空パスも所有するため、/manual/\*path と /manual の同時登録はできません。/manual/about のような具体的な子ルートは優先されます。                               |
| `重複`               | 大文字小文字を正規化し、パラメーター名を除いた形が同じルートは競合します。例: /articles/:id と /articles/:slug。                                                                   |
| `無効なパス`         | 末尾の /（ルート / を除く）、空・.・.. セグメント、途中のワイルドカードや名前のないワイルドカード、クエリー、ハッシュなどは指定できません。                                        |
| `/_effront`          | フレームワーク予約領域です。ルート直下の /:name のようにこの領域へも一致するパターンも make 時に拒否されます。                                                                     |

## Middleware と withMiddleware {#middleware}

`Middleware.make(handler)` は Effect HTTP のレスポンス Effect を受け取り、レスポンス Effect を返す Middleware を定義します。独自のエラー型を外側へ追加せず、受け取った Effect のエラーと残りのサービス要求を保ちます。認証などで失敗応答を返す場合は HTTP レスポンスへ変換します。

```tsx
import { Context, Effect } from "effect";
import { Application } from "@effront/core";

class RequestLabel extends Context.Service<
  RequestLabel,
  {
    readonly value: string;
  }
>()("example/RequestLabel") {}

const EFFRONT = Application.effront();
const ProvideLabel = EFFRONT.Middleware.make<{ provides: RequestLabel }>((httpEffect) =>
  httpEffect.pipe(Effect.provideService(RequestLabel, { value: "request" })),
);
const Scoped = EFFRONT.withMiddleware(ProvideLabel);
const Home = Scoped.Page.make({
  render: () =>
    Effect.gen(function* () {
      const label = yield* RequestLabel;
      return <h1>{label.value}</h1>;
    }),
});
```

`provides` はジェネリック型の設定であり、実行時のオプションではありません。実際のサービス提供は handler で行います。`withMiddleware` は必要なサービスが利用可能かを型で検証し、提供されるサービスを派生ファクトリーに追加します。

派生ファクトリーで作った Component・Page・Layout・Routes・ServerFn は、その時点の Middleware チェーンを保持します。追加順に外側から内側へ適用され、同じスコープへ同じ Middleware を二度追加すると `TypeError` になります。
