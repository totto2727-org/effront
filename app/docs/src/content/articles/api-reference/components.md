`Component`、`Page`、`Layout`、`Loading` は、[アプリケーションファクトリー](./application.md#identity) を通じて、描画内容やルートで共有する UI を定義します。

## 描画ファクトリー {#render}

| ファクトリー                                      | `render` の入力                             | `render` の出力                                           | `make` の戻り値                                          |
| ------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------- |
| `Component.make({ render })`                      | アプリケーションが定義する props            | `Effect.Effect<Awaited<ReactNode>, E, AvailableServices>` | JSX で使う非同期コンポーネント                           |
| `Page.make({ render, params?, viewTransition? })` | 引数なし、またはデコード済みの `{ params }` | 同じ Effect 型                                            | `Routes.page` に登録する定義。JSX コンポーネントではない |
| `Layout.make({ render })`                         | `{ children: Awaited<ReactNode> }`          | 同じ Effect 型                                            | `Routes.make({ layout })` に渡す非同期コンポーネント     |
| `Loading.make({ render })`                        | 引数なし                                    | 同期的な `Awaited<ReactNode>`                             | `Routes.make({ loading })` に渡すコンポーネント          |

`E` は描画の失敗型です。
`AvailableServices` は、アプリケーションのサービスと、ファクトリーのミドルウェアスコープが提供するサービスを含みます。
Loading は Effect や Promise を返せません。

## Layout と Loading {#loading}

Routes グループの Layout は、Loading のフォールバックも含めて内容を囲みます。
Loading は、そのスコープの Suspense フォールバックになります。
次の子グループは、4 種類の描画ファクトリーを使います。

```tsx
import { Effect } from "effect";
import { EFFRONT } from "./effront";

const Greeting = EFFRONT.Component.make({
  render: ({ name }: { readonly name: string }) => Effect.succeed(<p>Hello, {name}</p>),
});
const Home = EFFRONT.Page.make({
  render: () => Effect.succeed(<Greeting name="Ada" />),
});
const SectionLayout = EFFRONT.Layout.make({
  render: ({ children }) => Effect.succeed(<section>{children}</section>),
});
const Pending = EFFRONT.Loading.make({
  render: () => <p role="status">Loading…</p>,
});
export const section = EFFRONT.Routes.make({
  layout: SectionLayout,
  loading: Pending,
}).page("/", Home);
```

`./effront` はアプリケーションで共有するファクトリーを公開します。
[Application make](./application.md#make) の要件に従い、HTML 文書の Layout を持つルート Routes の下に `section` をマウントします。

## Page params {#params}

`Page.make({ params, render })` は `params` で URL 文字列をデコードし、その `Type` を `render` に渡します。

```tsx
import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";

const Article = EFFRONT.Page.make({
  params: Schema.Struct({ id: Schema.FiniteFromString }),
  render: ({ params }) => Effect.succeed(<h1>Article {params.id}</h1>),
});
export const articles = EFFRONT.Routes.make().page("/articles/:id", Article);
```

この例の `params.id` は数値です。
`articles` は、Layout を持つルート Routes の下にマウントする子グループです。

- 静的パスには、`params` のない Page が必要です。
- パラメーター付きパスの名前は、Schema の `Encoded` キーと過不足なく一致する必要があります。
- パラメーターの encoded 値は URL 文字列を受け付ける必要があります。
- Schema の文字列キーは既知かつ空でない必要があります。空の Struct や任意キーの Record は型の契約で拒否されます。

## PageViewTransition {#view-transition}

`@effront/core` の `PageViewTransition` は、組み込みの既定値を持つ Effect の `Context.Reference<PageViewTransitionConfig>` です。
Page の React 19.3 ViewTransition 境界を設定します。
共有 Layout は境界の外にあります。

| 設定                                                                    | 適用範囲                                                         |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------- |
| アプリケーション Layer 内の `Layer.succeed(PageViewTransition, config)` | アプリケーションの既定値。`Layer` は `effect` からインポートする |
| `Page.make({ viewTransition: config, render })`                         | その Page で指定したプロパティを上書きする                       |
| `Page.make({ viewTransition: false, render })`                          | その Page の境界を取り除く                                       |

| プロパティ                                    | 値                                                                                            |
| --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `enabled`                                     | 真偽値。既定で有効。                                                                          |
| `default`、`enter`、`exit`、`update`、`share` | React ViewTransition のクラス名、`"auto"`、`"none"`、または遷移タイプからクラスへのマッピング |

組み込みの `default` クラスは `"auto"` で、`hmr-refresh` と `navigation-ua-visual-transition` は `"none"` です。
上書きはマッピング内の要素を統合せず、マッピング全体を置き換えます。
アプリケーションが遷移を無効にしていても、Page で `enabled: true` を指定できます。

設定はシリアライズ可能な値だけを受け付け、コールバックは受け付けません。
独自の React 境界には自動の名前か別の名前を使ってください。
`effront-page` は予約済みです。
表示中の Page で明示的な `enabled` を変更すると、ローカル状態がリセットされる場合があります。
実行中に reduced-motion 設定が変わっても、境界と Page 内の入力状態は保持されます。
各 Page は自身の設定に従うため、遷移先で無効にしていても、有効な遷移元の Page はアニメーションする場合があります。
Page のアニメーションは、その後の Suspense の内容表示をすべて対象にはしません。
表示時にアニメーションさせる内容には、別の [React ViewTransition](https://react.dev/reference/react/ViewTransition) を使ってください。

アンカーでアプリケーション独自の遷移タイプを追加できます。

```tsx
<a href="/photos/2" data-effront-transition-types="photo-next">
  Next photo
</a>
```

| リンクの遷移タイプ | 契約                                                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 適用範囲           | 属性は push と replace でタイプを追加します。後から戻る・進むを操作しても再適用しません。                                                                      |
| クラスの対応付け   | `enter: { "photo-next": "photo-fade" }` などの設定で CSS クラスを選びます。対応する View Transition 疑似要素のスタイルはアプリケーション側で用意してください。 |
| 予約名             | 属性内の `navigation`、`navigation-*`、`server-function`、`hmr-refresh` は無視します。                                                                         |

Page とアプリケーションの設定例は[クライアントナビゲーション](/ja/advanced/client-navigation#transition-scope)を参照してください。
