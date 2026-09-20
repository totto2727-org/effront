`Page` でページを作り、`Layout` で共通の UI を定義し、`Routes` に URL を登録します。
ルートパラメーターで URL の値を受け取り、関連するページをグループにまとめてレイアウトや読み込み中の UI を共有できます。

## Page を登録する {#pages}

`src/entry.effront.tsx` で Page とルート Layout を作り、Page の URL を登録します。

```tsx
import { Application } from "@effront/core";
import { Effect } from "effect";

const EFFRONT = Application.effront();

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="en">
        <body>{children}</body>
      </html>,
    ),
});

const HomePage = EFFRONT.Page.make({
  render: () => Effect.succeed(<h1>Home</h1>),
});

const routes = EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage);

export default EFFRONT.make({ routes });
```

`/` を開くと、RootLayout の `children` の位置に `Home` と表示されます。
ルート Routes には Layout と少なくとも一つの Page が必要です。
以降の例で `routes` を置き換える際も、default export は残します。
`.page()` と `.mount()` は新しい定義を返すため、その戻り値を使ってください。

## URL パラメーターを受け取る {#matching}

`effect` の import に `Schema` を追加し、ルートパターンと同じ名前のパラメーターを持つ Page を定義します。

```tsx
const ArticlePage = EFFRONT.Page.make({
  params: Schema.Struct({ slug: Schema.NonEmptyString }),
  render: ({ params }) => Effect.succeed(<h1>{params.slug}</h1>),
});

const ManualPage = EFFRONT.Page.make({
  params: Schema.Struct({ path: Schema.String }),
  render: ({ params }) => Effect.succeed(<article>{params.path || "Manual"}</article>),
});

const routes = EFFRONT.Routes.make({ layout: RootLayout })
  .page("/", HomePage)
  .page("/articles/:slug", ArticlePage)
  .page("/manual/*path", ManualPage);
```

- `/articles/hello` は `hello` と表示します。
- `/manual/setup/install` は `setup/install` と表示します。
- `/manual` と `/manual/` では `path` が空文字列になり、`Manual` と表示します。

名前付きパラメーターは一つのセグメントを受け取ります。
catch-all は空文字列を含む残りのパスを受け取り、パターンの末尾にしか置けません。
`/manual/*path` が `/manual` も扱うため、`/manual` を別に登録しないでください。
`/manual/about` や `/manual/:section` のように具体的なパスは、catch-all より優先されます。
パラメーター名を変えても別のルートにはならず、`/articles/:slug` と `/articles/:id` は競合します。
`/_effront` と、それに一致しうるパターンは予約領域として残してください。

Schema は URL デコード済みの文字列を受け取り、デコードした値を `render` に渡します。
検証や変換には [Effect Schema](https://effect.website/docs/schema/introduction/) を使います。
GET と HEAD でデコードに失敗すると、クライアントナビゲーション中も描画前に 404 を返します。
未登録の URL も 404 になります。
パラメーターの Schema は、ルートの Middleware が提供するサービスを使えます。

Server Function の POST 後のページ更新中にパラメーターのデコードが失敗した場合は、アクションの結果を保持したまま、React のエラー処理で描画が失敗します。
更新後のページが表示できなかったことだけを理由に、変更操作を再実行しないでください。

## セクションの Layout と読み込み表示を追加する {#mount}

子 Routes グループを定義し、固定プレフィックスに mount します。

```tsx
const ArticleLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <section>
        <h1>Articles</h1>
        {children}
      </section>,
    ),
});

const ArticleLoading = EFFRONT.Loading.make({
  render: () => <p>Loading article…</p>,
});

const articles = EFFRONT.Routes.make({
  layout: ArticleLayout,
  loading: ArticleLoading,
}).page("/:slug", ArticlePage);

const routes = EFFRONT.Routes.make({ layout: RootLayout })
  .page("/", HomePage)
  .page("/manual/*path", ManualPage)
  .mount("/articles", articles);
```

`/articles/hello` では、ArticlePage が ArticleLayout、RootLayout の内側に表示されます。
親にあった `.page("/articles/:slug", ArticlePage)` の登録は残さないでください。
記事の内容が suspend している間は、ArticleLayout の内側に ArticleLoading が表示されます。
Loading の `render` は Effect ではなく同期的な ReactNode を返し、すぐに応答が完成する場合は読み込み表示が見えないこともあります。

子の `layout` と `loading` は省略できます。
mount するグループには Page が必要で、プレフィックスは固定にします。
動的パラメーターは子の `.page()` パターンで宣言してください。
定義を複数のモジュールに分ける場合は、一つの `EFFRONT` を export して再利用します。
別々の `Application.effront()` から作った定義は組み合わせられません。

ナビゲーションには通常のリンクを使います。
標準のクロスフェードを変更するには、[PageViewTransition の設定](/advanced/client-navigation#transition-scope)を参照してください。
