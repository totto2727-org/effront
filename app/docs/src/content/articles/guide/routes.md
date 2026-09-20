ルーティングは、URL と表示するページを対応付ける仕組みです。
Effront では、URL のパターンごとに Page を登録し、パスから受け取る値を検証し、共通の UI が必要なページをグループにまとめます。
このガイドでは、`src/entry.effront.tsx` にホームページ、記事のルート、マニュアルのセクションを作ります。
アプリケーションのホスト設定は完了しているものとします。

## URL からページを開けるようにする {#pages}

Page は表示する内容を返し、最上位の Layout はそれを包む HTML 文書を返します。
同じ `EFFRONT` から両方を作り、`.page()` で Page を登録して、アプリケーション定義を export します。

```tsx
import { Application } from "@effront/core";
import { Effect } from "effect";

const EFFRONT = Application.effront();

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="ja">
        <body>{children}</body>
      </html>,
    ),
});

const HomePage = EFFRONT.Page.make({
  render: () => Effect.succeed(<h1>ホーム</h1>),
});

const routes = EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage);

export default EFFRONT.make({ routes });
```

`/` を開くと、RootLayout が返す文書の中に「ホーム」が表示されます。
選ばれた Page の表示位置は `children` で決まります。
ルートを増やす場合も、`EFFRONT.make` に渡す最上位の Routes には Layout が必要です。

アプリケーションを広げるときは `.page()` や `.mount()` をつなぎ、その結果を `EFFRONT.make` に渡します。
これらのメソッドは既存の Routes を変更せず、新しい定義を返します。
以降の例では上の `routes` 宣言を置き換え、default export はそのまま使います。

## URL のパターンと受け付ける値を決める {#matching}

ページが URL のどの部分を必要とするかに合わせて、パターンを選びます。

| パターン          | 用途               | 受け取る値                    |
| ----------------- | ------------------ | ----------------------------- |
| `/`               | 固定のホームページ | なし                          |
| `/articles/:slug` | 記事1件の識別子    | `hello` などの `slug`         |
| `/manual/*path`   | 深さが変わるパス   | `setup/install` などの `path` |

パラメーターを持つどちらのパターンでも、Page の Schema にルートパラメーターと同じ名前のキーを宣言します。
Schema は URL デコード済みの文字列を受け取り、検証・変換した結果を `render` に渡します。
`effect` の import に `Schema` を加え、2つの Page を `routes` より前に定義して、`routes` を次のように置き換えます。

```tsx
const ArticlePage = EFFRONT.Page.make({
  params: Schema.Struct({ slug: Schema.NonEmptyString }),
  render: ({ params }) =>
    Effect.succeed(
      <article>
        <h1>{params.slug}</h1>
      </article>,
    ),
});

const ManualPage = EFFRONT.Page.make({
  params: Schema.Struct({ path: Schema.String }),
  render: ({ params }) => Effect.succeed(<article>{params.path}</article>),
});

const routes = EFFRONT.Routes.make({ layout: RootLayout })
  .page("/", HomePage)
  .page("/articles/:slug", ArticlePage)
  .page("/manual/*path", ManualPage);
```

これで `/articles/hello` には「hello」、`/manual/setup/install` には「setup/install」が表示されます。
末尾の `*path` は catch-all で、パスの残りすべてを受け取り、`/manual` と `/manual/` では空文字列になります。
マニュアルでは、この2つの入口 URL も受け付けるために `Schema.String` を使っています。
入口にマニュアルの案内を表示したい場合は、ManualPage で空文字列を扱ってください。
catch-all はパターンの末尾にだけ置くことができ、入口の URL も含むため、`/manual` を別の Page として同時に登録することはできません。

**ページが受け付ける値を検証する**

Page の Schema を使うと、ページに適さない値を拒否したり、文字列を描画処理で必要な型に変換したりできます。
定義方法は [Effect Schema のドキュメント](https://effect.website/docs/schema/introduction/) を参照してください。
GET と HEAD では、Effront は描画前に Schema でパラメーターを一度だけ検証・変換します。
失敗した場合は 404 を返し、Page の `render` は呼び出されません。
ページ遷移の Flight リクエストも同様で、拒否された場合は空の 404 レスポンスになります。
Schema の処理でサービスが必要な場合は、そのルートの Middleware が提供するサービスを利用できます。

Server Function による再表示では失敗時の扱いが異なり、POST 後の描画でパラメーターの検証・変換に失敗しても、完了した操作の結果は保持され、ページ側は React のレンダリングエラーとして扱われます。
この描画の失敗を、操作が実行されなかった証拠として扱わないでください。

**競合するルートの登録を避ける**

パラメーター名だけが異なるパターンは別ルートにはならず、`/articles/:slug` と `/articles/:id` は競合します。
一方、より具体的なルートは catch-all と併用でき、`/manual/about` や `/manual/:section` は `/manual/*path` より先に照合されます。
`/_effront` 名前空間と、それに一致する可能性のあるパターンは、フレームワークのために予約されています。
登録されていない URL は 404 になります。

## 共通の UI を持つページをまとめる {#mount}

同じセクションに属するページが増えたら、子 Routes にまとめて共通のレイアウトと読み込み中の表示を設定します。
記事のセクションでは、`/:slug` の登録を子 Routes に移し、そのグループを `/articles` にマウントします。
次の定義を `routes` より前に追加し、`routes` を例のとおりに置き換えます。

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
  .page("/manual/*path", ManualPage)
  .mount("/articles", articles);
```

`/articles/hello` は引き続き ArticlePage に対応しますが、今度は ArticleLayout、さらにその外側の RootLayout に包まれます。
ホームページとマニュアルは ArticleLayout の外側に置かれたままです。
記事のルートはマウントによる登録だけにし、親の `.page("/articles/:slug", ArticlePage)` は残さないでください。

ArticleLoading は記事の内容に対する Suspense の待機表示で、内容の描画が待機状態になると ArticleLayout の内側に表示されます。
この例はすぐに内容を返すため、待機表示が見える前に描画が終わる場合があります。
Loading は同期的な ReactNode を返し、Effect を返す Page や Layout とは異なります。

子 Routes の `layout` や `loading` は、その設定が不要なら省略できます。
ページを登録した子 Routes を、`/articles` のような固定の接頭辞にマウントしてください。
動的なパラメーターは、子 Routes の `.page()` のパターンに記述します。
グループやページを別のモジュールへ移す場合は、共有する1つの `EFFRONT` を export し、各定義を作る場所で import します。
別々の `Application.effront()` 呼び出しから作った値を、同じアプリケーションで組み合わせることはできません。

ルートを用意したら、通常のリンクでページ間を移動できます。
ページ遷移は既定でクロスフェードします。
変更や無効化の方法は [PageViewTransition の設定](/advanced/client-navigation#transition-scope) を参照してください。
