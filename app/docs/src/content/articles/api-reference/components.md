## 描画 API {#render}

以下の呼び出し形はすべて `EFFRONT`、または `EFFRONT.withMiddleware(...)` の戻り値から利用します。Component・Page・Layout の render は `Effect.Effect<Awaited<ReactNode>, E, AvailableServices>` を返します。E は任意のエラー型です。利用可能なサービスは、アプリケーションのサービスと適用済み Middleware が提供するサービスです。

| API / 項目                      | 契約                                                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `Component.make({ render })`    | render(props) の props 型は利用者が指定。戻り値は JSX に配置できる非同期コンポーネントです。              |
| `Page.make({ render })`         | 静的 Page。render() は引数なし。戻り値は Routes.page に登録する定義です。                                 |
| `Page.make({ params, render })` | パラメーター付き Page。render({ params }) は Schema でデコード済みの値を受け取ります。                    |
| `Layout.make({ render })`       | render({ children }) の children は Awaited&lt;ReactNode&gt;。戻り値を Routes.make の layout に渡します。 |
| `Loading.make({ render })`      | render() は ReactNode を同期的に返します。戻り値を Routes.make の loading に渡します。                    |

```tsx
const Greeting = EFFRONT.Component.make({
  render: ({ name }: { readonly name: string }) => Effect.succeed(<p>こんにちは、{name}</p>),
});
const Home = EFFRONT.Page.make({
  render: () => Effect.succeed(<Greeting name="太郎" />),
});
```

このページの断片では `Effect`・`Schema` を `effect` から、`EFFRONT` を共有するアプリケーションモジュールから読み込むものとします。Page は JSX コンポーネントとして直接呼ぶのではなく、Routes に登録します。

## PageViewTransition {#view-transition}

`import { PageViewTransition } from "@effront/core"` で読み込む Effect の既定値付きコンテキストです。`Layer.succeed(PageViewTransition, config)` をアプリケーションの Layer に組み合わせます。 各 Page の `viewTransition` は指定したプロパティだけを上書きします。 遷移種別の対応表はプロパティごと置き換え、表の中身はマージしません。

| API / 項目                                      | 契約                                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------------------- |
| `enabled`                                       | 既定は true。false はフレームワークの Page アニメーションを無効化します。     |
| `default / enter / exit / update / share`       | React ViewTransition のクラス名、auto、none、または遷移種別とクラスの対応表。 |
| `Page.make({ viewTransition: false, render })`  | この Page のアニメーションを無効化します。                                    |
| `Page.make({ viewTransition: config, render })` | この Page に個別の設定を指定します。                                          |

設定は Flight を通るシリアライズ可能な値です。 境界名 effront-page はフレームワーク用に予約されています。独自の境界には React の自動名か別の名前を使います。コールバックは設定に含めず、独自の React 境界で扱います。 利用例は [ページ遷移のアニメーション](/advanced/client-navigation#transition-scope) を参照してください。

全体で無効にした場合も Page 側の enabled: true で有効にできます。 表示中に enabled を切り替えると境界が追加・削除されるため、ページ内の状態が再初期化される場合があります。 継続して保持する状態は共有 Layout に置きます。 OS の減速モーション設定の切替では境界を維持し、ページ内の入力状態を保持します。

## Page の params {#params}

```tsx
const Article = EFFRONT.Page.make({
  params: Schema.Struct({ id: Schema.FiniteFromString }),
  render: ({ params }) => Effect.succeed(<h1>記事 {params.id}</h1>),
});
const routes = EFFRONT.Routes.make().page("/articles/:id", Article);
```

上の `params.id` は `number` です。Schema の Encoded 側のキーがパスのパラメーター名と過不足なく一致し、各値が URL 由来の文字列を受け取れる必要があります。キーが空の Schema や任意の文字列キーを持つ Record ではなく、キーを確定できる Schema を渡します。

静的パスには params のない Page を、`:id` などを含むパスには対応する params Schema を持つ Page を登録します。

## Layout と Loading {#loading}

```tsx
const SectionLayout = EFFRONT.Layout.make({
  render: ({ children }) => Effect.succeed(<section>{children}</section>),
});
const Pending = EFFRONT.Loading.make({
  render: () => <p role="status">読み込み中…</p>,
});
const section = EFFRONT.Routes.make({
  layout: SectionLayout,
  loading: Pending,
}).page("/", Home);
```

Loading はルートの Suspense fallback を定義します。Effect や Promise を返さず、同期的に表示できる UI を返します。ルート Layout は HTML 文書の外枠を、子 Routes の Layout はその内側の UI を担当できます。
