`Layout` でページ共通の HTML を、`Page` で各ページの内容を定義し、`Routes` で URL に接続します。
このガイドではトップページから始めて、URL パラメーターと、専用のレイアウトや読み込み表示を持つセクションを追加します。

[はじめにのサンプル](./getting-started.md)を [http://127.0.0.1:1340](http://127.0.0.1:1340) で起動した状態で進めます。
最初の三つのセクションで `src/entry.effront.tsx` の構成要素を説明し、[エントリー全体](#application)でそれらを組み合わせます。

## 共通の Layout を定義する {#layouts}

Layout はページを囲む HTML を描画します。
`children` にはページの内容が入り、ルートをグループ化した場合は子のレイアウトが入ります。
ルート Layout はドキュメントの `<html>` と `<body>` 要素を提供します。

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
```

`Application.effront()` は、このファイルの Layout、Page、Routes を作るための定義を生成します。
Layout の `render` は React 要素を含む Effect を返します。

## Page の内容を定義する {#pages}

Page は URL に対応するページの内容を提供します。
`RootLayout` の後に `HomePage` を定義します。

```tsx
const HomePage = EFFRONT.Page.make({
  render: () => Effect.succeed(<h1>Home</h1>),
});
```

ここではデータを読み込む必要がないため、`Effect.succeed` で内容を包みます。
データを使うページでは、`render` の中で[アプリケーションサービス](./effect.md)を読み取り、要素を返せます。
Page を定義しただけでは、まだ URL は割り当てられません。

## Routes で Layout と Page を接続する {#routes}

`Routes.make` はルートグループを作ります。
最上位のルートグループに Layout を渡し、`.page(path, page)` で URL パスと Page を関連付けます。

```tsx
const routes = EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage);
```

この登録により、ブラウザーが `/` を要求すると `RootLayout` の内側に `HomePage` が描画されます。
アプリケーションに渡す最上位のルートグループには Layout と少なくとも一つの Page が必要です。
`.page()` と `.mount()` は新しいルート定義を返すため、その戻り値を保持してください。

## エントリー全体を組み合わせて動かす {#application}

`src/entry.effront.tsx` を次のエントリー全体で置き換えます。
default export で、設定したルートをアプリケーションに渡します。

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

保存して [http://127.0.0.1:1340](http://127.0.0.1:1340) を開くと、RootLayout の `children` の位置に `Home` と表示されます。
以降の例で `routes` を置き換える際も、import、各定義、default export は残してください。

## URL パラメーターを受け取る {#matching}

`effect` の import に `Schema` を追加します。
既存の `routes` 宣言より前に `ArticlePage` と `ManualPage` を追加し、`routes` 宣言を次のものに置き換えます。

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

- [http://127.0.0.1:1340/articles/hello](http://127.0.0.1:1340/articles/hello) は `hello` と表示します。
- [http://127.0.0.1:1340/manual/setup/install](http://127.0.0.1:1340/manual/setup/install) は `setup/install` と表示します。
- [http://127.0.0.1:1340/manual](http://127.0.0.1:1340/manual) と [http://127.0.0.1:1340/manual/](http://127.0.0.1:1340/manual/) では `path` が空文字列になり、`Manual` と表示します。

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
マッチングとデコードの詳しい契約は、[ルーティング API リファレンス](../api-reference/routing.md)を参照してください。

## セクションの Layout と読み込み表示を追加する {#mount}

既存の `routes` 宣言より前に `ArticleLayout`、`ArticleLoading`、子グループの `articles` を追加します。
`routes` 宣言を次のものに置き換え、固定プレフィックスに mount します。

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

[http://127.0.0.1:1340/articles/hello](http://127.0.0.1:1340/articles/hello) では、ArticlePage が ArticleLayout、RootLayout の内側に表示されます。
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
