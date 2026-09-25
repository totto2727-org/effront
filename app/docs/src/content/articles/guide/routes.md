`Layout` でページ共通の HTML を、`Page` で各ページの内容を定義し、`Routes` で URL に接続します。
このガイドではトップページから始めて、パスパラメーターと、専用のレイアウトや読み込み表示を持つセクションを追加します。

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

保存後、ブラウザーで `/` を開くと、RootLayout の `children` の位置に `Home` と表示されます。

## パスパラメーターを受け取る {#matching}

`src/entry.effront.tsx` で `Schema` を追加し、`routes` より前に二つの Page を定義して、ルート登録を置き換えます。

```tsx
// src/entry.effront.tsx: replace the effect import.
import { Effect, Schema } from "effect";

// Add both Pages immediately before routes.
const ArticlePage = EFFRONT.Page.make({
  params: Schema.Struct({ slug: Schema.NonEmptyString }),
  render: ({ params }) => Effect.succeed(<h1>{params.slug}</h1>),
});

const ManualPage = EFFRONT.Page.make({
  params: Schema.Struct({ path: Schema.String }),
  render: ({ params }) => Effect.succeed(<article>{params.path || "Manual"}</article>),
});

// Replace routes.
const routes = EFFRONT.Routes.make({ layout: RootLayout })
  .page("/", HomePage)
  .page("/articles/:slug", ArticlePage)
  .page("/manual/*path", ManualPage);
```

ブラウザーでは、次のパスを開けます。

- `/articles/hello` は `hello` と表示します。
- `/manual/setup/install` は `setup/install` と表示します。
- `/manual` と `/manual/` では `path` が空文字列になり、`Manual` と表示します。

名前付きパラメーターは一つのセグメントを受け取ります。
catch-all は空文字列を含む残りのパスを受け取り、パターンの末尾にしか置けません。
`/manual/*path` が `/manual` も扱うため、`/manual` を別に登録しないでください。
`/manual/about` や `/manual/:section` のように具体的なパスは、catch-all より優先されます。
パラメーター名を変えても別のルートにはならず、`/articles/:slug` と `/articles/:id` は競合します。

> [!WARNING]
> `/_effront` と、それに一致しうるパターンは予約領域として残してください。

Schema は URL デコード済みの文字列を受け取り、デコードした値を `render` に渡します。
検証や変換には [Effect Schema](https://effect.website/docs/schema/introduction/) を使います。
GET と HEAD でデコードに失敗すると、クライアントナビゲーション中も描画前に 404 を返します。
未登録の URL も 404 になります。
マッチングとデコードの詳しい契約は、[ルーティング API リファレンス](../api-reference/routing.md)を参照してください。

## セクションの Layout と読み込み表示を追加する {#mount}

`src/entry.effront.tsx` の ArticlePage を置き換え、`routes` より前にセクションの定義を追加してルート登録を置き換えます。

```tsx
// Replace ArticlePage to make the loading UI visible.
const ArticlePage = EFFRONT.Page.make({
  params: Schema.Struct({ slug: Schema.NonEmptyString }),
  render: Effect.fn("ArticlePage.render")(function* ({ params }) {
    yield* Effect.sleep("2 seconds");
    return <h1>{params.slug}</h1>;
  }),
});

// Add these definitions immediately before routes.
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

// Replace routes, removing the direct /articles/:slug registration.
const routes = EFFRONT.Routes.make({ layout: RootLayout })
  .page("/", HomePage)
  .page("/manual/*path", ManualPage)
  .mount("/articles", articles);
```

ブラウザーで `/articles/hello` を開きます。
ArticleLayout の `Articles` の下に `Loading article…` が表示され、2 秒の待機後に読み込み表示が `hello` に置き換わります。
