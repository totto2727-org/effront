Routes は不変です。`page` と `mount` は新しい定義を返すので、戻り値をつないでアプリケーションのグラフを組み立てます。

## 静的ページ、パラメーター、catch-all {#pages}

パラメーター付き Page は URL の文字列を schema で decode してから `render` に渡します。 パスの `:slug` と schema のキーは一致させます。schema の定義方法は [Effect Schema documentation](https://effect.website/docs/schema/introduction/) を参照してください。

```tsx
import { Effect, Schema } from "effect";

const ArticlePage = EFFRONT.Page.make({
  params: Schema.Struct({ slug: Schema.NonEmptyString }),
  render: ({ params }) =>
    Effect.succeed(
      <article>
        <h1>{params.slug}</h1>
      </article>,
    ),
});

const HomePage = EFFRONT.Page.make({
  render: () => Effect.succeed(<h1>ホーム</h1>),
});
```

末尾に置く `*path` は、その位置から残りのパスを1つの名前付きパラメーターとして受け取る catch-all です。

```tsx
const ManualPage = EFFRONT.Page.make({
  params: Schema.Struct({ path: Schema.String }),
  render: ({ params }) => Effect.succeed(<article>{params.path}</article>),
});

const routes = EFFRONT.Routes.make({ layout: RootLayout }).page("/manual/*path", ManualPage);
```

`/manual` と `/manual/` では `path` は空文字列になります。`/manual/a/b` では Effect HTTP が一度だけdecodeした `"a/b"` をSchemaへ渡します。URLの照合と検証はEffect HTTPへ委ね、coreはcatch-allの名前を変換します。 catch-all は末尾だけに置けます。`/manual` を別のPageとして同時に登録することはできません。

## ネストした Routes と Loading {#mount}

子 Routes を `mount` すると、その Layout と Loading の祖先関係を保ったままプレフィックスの下へ追加します。

```tsx
const ArticleLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <section>
        <h1>記事</h1>
        {children}
      </section>,
    ),
});

const ArticleLoading = EFFRONT.Loading.make({
  render: () => <p>記事を読み込み中…</p>,
});

const articles = EFFRONT.Routes.make({
  layout: ArticleLayout,
  loading: ArticleLoading,
}).page("/:slug", ArticlePage);

const routes = EFFRONT.Routes.make({ layout: RootLayout })
  .page("/", HomePage)
  .mount("/articles", articles);
```

Layout の `children` に子の表示が入り、Loading はそのスコープの Suspense の待機表示になります。 Loading の `render` は Effect ではなく同期的な ReactNode を返します。 最上位の Routes には HTML 文書を返す RootLayout を指定し、最後に `EFFRONT.make({ routes })` へ渡します。

## マッチング時の注意 {#matching}

GET と HEAD では、レンダリング前に Page のパスパラメーターを Schema で一度だけ decode します。 この Schema に適合しないパスは 404 を返します。予約済みの `/_effront` 名前空間はアプリケーションのルートに使えません。 ナビゲーション用の Flight リクエストでも、decode 失敗時は空の 404 です。 decode には、そのルートで有効な Middleware が提供するサービスを使えます。

Server Function の POST 後の再表示では、パラメーターの拒否を React のレンダリングエラーとして扱い、完了した action の結果を保持します。 URL のマッチングは Effect HTTP に任せ、Routes の構築時には同じ形のパスの重複や不正な合成を検出します。 たとえば `/articles/:slug` と `/articles/:id` は別ルートとして重ねられません。

catch-all と同じ接頭辞に置いたリテラルや `:parameter` は、より具体的なルートとして catch-all より先に照合されます。パーセントエンコードが不正なURL、エンコードされた`/`・`\`、NUL を含む catch-all のリクエストは 404 です。

ページ遷移は既定でクロスフェードします。全体設定やページごとの変更・無効化は[PageViewTransition の設定](/advanced/client-navigation#transition-scope) を参照してください。

<details>

<summary>ルートを分割したい場合</summary>

一つのモジュールで `Application.effront()` を作り、それを import して Page、Layout、Routes を定義してください。異なる EFFRONT identity から作った値は同じアプリケーションに混ぜられません。

</details>
