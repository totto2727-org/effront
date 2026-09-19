`Routes` は、各 URL を処理する Page を決め、共通の Layout や Loading を持つセクションを組み立てるために使います。
セクションに認証や Page へのサービス提供などのリクエスト処理も必要な場合は、スコープ付き `Middleware` を追加します。
このリファレンスでは、これらの定義の組み立て方と、ルートや Middleware を登録できないときに確認する契約を説明します。

## ルートの登録と合成 {#routes}

`page` をつないでルートの集合を作り、`mount` で共通の URL プレフィックスの下に配置します。
たとえば記事セクションでは、`/articles` を繰り返し書かずに一覧と詳細のパスを定義できます。

```typescript
const articles = EFFRONT.Routes.make().page("/", ArticleIndex).page("/:id", Article);
const routes = EFFRONT.Routes.make({ layout: RootLayout })
  .page("/", Home)
  .mount("/articles", articles);
```

ここでは、`Home`・`ArticleIndex`・`Article`・`RootLayout` は共有する `EFFRONT` から作成済みの定義とします。
`Article` は、入力キー `id` を持つ `params` Schema を宣言します。
登録されるパスと Page の対応は次のとおりです。

| URL パターン    | Page           |
| --------------- | -------------- |
| `/`             | `Home`         |
| `/articles`     | `ArticleIndex` |
| `/articles/:id` | `Article`      |

子の `/` は `/articles` 自体に対応し、`/articles/` というパターンが登録されるわけではありません。
組み立てた定義は `EFFRONT.make({ routes })` に渡し、アプリケーションのルートとして使います。
最上位の Routes には1つ以上の Page を含め、HTML 文書を描画する RootLayout を指定してください。

**ビルダーのメソッド**

| メソッド                             | 受け付ける入力                                           | 結果                                                                              |
| ------------------------------------ | -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `Routes.make()`                      | 引数なし。                                               | 子ルートの組み立てに使う、Layout と Loading を持たない空の Routes。               |
| `Routes.make({ layout?, loading? })` | 省略可能な Layout と Loading の定義。                    | 共通の Layout や Suspense の待機表示を持つ空の Routes。                           |
| `routes.page(path, page)`            | パスのリテラルと、パラメーター名が一致する Page。        | Page を追加した新しい Routes。                                                    |
| `routes.mount(prefix, child)`        | 静的なプレフィックスと、1つ以上の Page を含む子 Routes。 | Layout と Loading の入れ子を保ち、プレフィックス付きの子パスを含む新しい Routes。 |

`page` と `mount` は呼び出し元の Routes を変更しません。
呼び出した結果を捨てずに、例のように戻り値をつないで使ってください。

Page・Layout・Loading・子 Routes は、すべて同じ `Application.effront()` から作る必要があります。
別々のモジュールで定義する場合は、共有する `EFFRONT` を import します。
`withMiddleware` で派生させた定義も同じアプリケーションに属するため、ほかの定義と組み合わせられます。

## パスと Page パラメーターの対応 {#paths}

パスのパターンと Page の `params` は、対応を確認しながら決めます。
静的パスには `params` のない Page が必要です。
動的パスでは、Schema の入力キーをすべてのパラメーター名と過不足なく一致させ、入力値が URL 由来の文字列を受け付けられるようにします。
Page には、[Page の params](/api-reference/components#params) で説明するデコード済みの値が渡ります。

| パターン        | 一致するパス                                                 | Schema に必要な入力キー |
| --------------- | ------------------------------------------------------------ | ----------------------- |
| `/articles`     | 固定のパス。                                                 | `params` Schema なし。  |
| `/articles/:id` | `/articles/` に続く1セグメント。                             | `id`                    |
| `/manual/*path` | `/manual` と `/manual/` での空文字列を含む、残りのパス全体。 | `path`                  |

`:name` はセグメント全体、`*name` は最後のセグメント全体に使います。
マウントのプレフィックスは常に静的なので、パラメーターは `mount` のプレフィックスではなく子のページのパスに置いてください。

**catch-all を選ぶ場合**

catch-all は、深さが任意のコンテンツを1つの Page で扱う場合に適しています。
`/manual/*path` に対する `/manual/a/b` は `"a/b"` を、`/manual` と `/manual/` は `""` を Schema に渡します。
その入口も同じ Page で扱うなら、`Schema.String` など空文字列を受け付ける Schema を使います。
捕捉値はすでに一度 URL デコードされているので、再度 URL デコードしないでください。
catch-all のリクエストパスに不正なパーセントエンコード、エンコードされた `/`・`\`、NUL が含まれる場合は 404 応答になります。

**登録の重複と優先順位**

catch-all は空文字列を捕捉するパスも受け持つため、`/manual/*path` は `/manual` と競合します。
`/manual/about` や `/manual/:slug` のような具体的な子パスは併用でき、catch-all より優先されます。

そのほかの重複パターンは、大文字小文字やパラメーター名を区別せずに比較します。
たとえば `/Articles` と `/articles`、`/articles/:id` と `/articles/:slug` はそれぞれ競合します。
`mount` が作る完全なパスにも重複チェックが適用されます。

**登録時の制約**

- `/` で始まる絶対パスのリテラルを指定し、クエリーやハッシュは含めません。
- `/` 自体を除き、末尾の `/`、空のセグメント、`.`・`..` セグメントは使えません。
- 登録パスには `?`・`#`・`%`・`;`・`\` を含められません。
- パラメーター名はパス内で一意にし、catch-all には名前を付けて末尾に置きます。
- パラメーター名には `:`・`*`・`.`・`-`・丸括弧を使えません。
  たとえば `:user-id` ではなく `:userId` を使います。

`/_effront` はフレームワークの予約領域です。
`EFFRONT.make({ routes })` は、最上位の `/:name` や `/*path` のように、この領域にも一致し得るパターンを拒否します。
代わりに `/articles/:name` のような静的なプレフィックスを付けてください。

## ルートの集合に Middleware を適用する {#middleware}

`Middleware.make` で Middleware を作り、`withMiddleware` で `EFFRONT` を派生させ、その派生定義から Middleware を実行したい Routes を作ります。
次の例は Page にサービスを提供します。

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
const scopedRoutes = Scoped.Routes.make().page("/", Home);
```

`scopedRoutes` を RootLayout のある親 Routes に `mount` すると、その Page に `request` が表示されます。
`Scoped.Routes.make()` の呼び出しで、このルートの集合に Middleware が適用されます。
`Scoped.Page.make(...)` だけで Page を作り、元の `EFFRONT.Routes.make()` に登録しても Middleware は有効になりません。
Page・Layout・Component は、有効なスコープの内側で描画されるときに提供サービスを利用します。
`Scoped` から作った Server Function は、呼び出し時に自身の Middleware を適用します。
アプリケーションや Server Function に接続する例は [Middleware ガイド](/guide/middleware) を参照してください。

**入力・戻り値・サービス要求**

| API                                               | 契約                                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `Middleware.make(handler)`                        | 後続の HTTP レスポンス Effect を受け取り、HTTP レスポンス Effect を返す handler を持つ Middleware 定義を返します。 |
| `Middleware.make<{ provides: Service }>(handler)` | handler が後続処理へ提供するサービスを宣言します。                                                                 |
| `EFFRONT.withMiddleware(middleware)`              | 元の `EFFRONT` を変更せず、Middleware とその提供サービスを追加した派生定義を返します。                             |

`provides` はジェネリック型の宣言であり、実行時のサービスの値ではありません。
上の `Effect.provideService` のように、handler で実際に値を提供する必要があります。
`withMiddleware` は Middleware の要求するサービスが利用可能かを型で検証し、Middleware 自体も同じアプリケーションに属する必要があります。

handler は、独自のエラー型を追加せず、後続 Effect のエラー型と残りのサービス要求を保ちます。
リクエストを拒否する場合は、認証失敗などを 401 といった HTTP レスポンスに変換し、後続処理を実行する代わりにそのレスポンスを返します。

**実行順序と適用範囲**

`EFFRONT.withMiddleware(first).withMiddleware(second)` は、`first`、`second`、後続処理の順に入ります。
応答は逆順に戻ります。
同じ Middleware を同じチェーンに二度追加すると `TypeError` になります。

スコープ付き Middleware の対象はその Routes と Server Function であり、ユーザー定義 HTTP、静的アセット、未知のルートは対象外です。
それらのリクエストにも共通の処理を適用する場合は、[HTTP 全体の Middleware](/guide/http) を使います。
