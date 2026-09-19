再利用できる React UI からルートに対応するページを組み立て、共通の Layout と読み込み中の表示を追加できます。
このリファレンスでは、用途に合う描画ファクトリーを選び、ページ全体の構成を変えずにルートのパラメーターやページ遷移を設定する方法を確認できます。

## 描画ファクトリーを選ぶ {#render}

作成した値をどこで使うかに応じて、ファクトリーを選びます。
4 つのファクトリーは、いずれも `EFFRONT` または `EFFRONT.withMiddleware(...)` の戻り値から利用できます。

| ファクトリー                 | コールバックの契約                                                                              | 作成した値の使い方                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `Component.make({ render })` | 利用者が型を指定する `props` を受け取り、`render(props)` が Effect を返します。                 | 非同期コンポーネントとして JSX に配置します。 |
| `Page.make({ render })`      | `render()` が Effect を返し、`params` Schema を指定した場合は `render({ params })` を使います。 | `Routes.page` に定義を登録します。            |
| `Layout.make({ render })`    | `render({ children })` が Effect を返し、`children` の型は `Awaited<ReactNode>` です。          | `Routes.make` の `layout` に渡します。        |
| `Loading.make({ render })`   | `render()` が `Awaited<ReactNode>` を同期的に返します。                                         | `Routes.make` の `loading` に渡します。       |

Component・Page・Layout の `render` の戻り値は、正確には `Effect.Effect<Awaited<ReactNode>, E, AvailableServices>` です。
`E` は利用者が定めるエラー型で、`AvailableServices` はアプリケーションのサービスと適用済み Middleware が提供するサービスです。
Loading だけは同期処理なので、Effect や Promise を返してはいけません。

コード例では `Effect`・`Schema` を `effect` から、`EFFRONT` を共有するアプリケーションモジュールから読み込むものとします。
JSX で組み合わせる UI には Component を使い、その UI をルートに結び付ける定義には Page を使います。

```tsx
const Greeting = EFFRONT.Component.make({
  render: ({ name }: { readonly name: string }) => Effect.succeed(<p>こんにちは、{name}</p>),
});
const Home = EFFRONT.Page.make({
  render: () => Effect.succeed(<Greeting name="太郎" />),
});
```

`Greeting` は通常の props を受け取りますが、`Home` は `<Home />` として描画せず、`Routes.page` に登録します。
追加の Layout が不要な子ルートのグループなら、`EFFRONT.Routes.make().page("/", Home)` で Page を登録できます。
Layout のないグループは、[Application の make](./application.md#make) で説明する、Layout の定義が必須となるアプリケーションのルート Routes の下にマウントしてください。
次の節では、この Page に Layout と読み込み中の UI を追加します。

## 共有 Layout と読み込み中の UI を追加する {#loading}

同じグループのルートで共通の外枠を使う場合は、Routes に Layout を設定します。
同じ範囲に Loading を設定すると、その内容の読み込み中に表示する Suspense fallback を指定できます。

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

Layout は内容全体を囲み、Loading の fallback を表示するときもその外側に残ります。
Loading からはその場で表示できる UI を返し、非同期の描画処理は Component・Page・Layout に置きます。
ルート Layout は HTML 文書の外枠を、子 Routes の Layout はその内側の共通 UI を担当できます。

## Page で使う URL パラメーターをデコードする {#params}

静的パスには、`params` のない Page を使います。
パラメーター付きパスでは、URL の値を Page で必要な値に変換する Schema を指定します。

```tsx
const Article = EFFRONT.Page.make({
  params: Schema.Struct({ id: Schema.FiniteFromString }),
  render: ({ params }) => Effect.succeed(<h1>記事 {params.id}</h1>),
});
const routes = EFFRONT.Routes.make().page("/articles/:id", Article);
```

Schema は `render` に渡す前に URL の文字列をデコードするため、この例の `params.id` は `number` です。
前の Layout なしの例と同様に、この `routes` は Layout を持つルート Routes の下にマウントする子グループです。
Page と登録先のパスは、次の条件を満たす必要があります。

- Schema の Encoded 側のキーが、パスのパラメーター名と過不足なく一致すること。
- 各パラメーターの Encoded 側の値が、URL の文字列を受け取れること。
- Schema のキーを確定でき、キーが 1 つ以上あること。
  キーが空の Schema や、任意の文字列キーを持つ Record はこの条件を満たしません。

## ページ遷移を設定する {#view-transition}

Effront は安定版 React 19.3 の `ViewTransition` を使って、Page の切り替えをアニメーションします。
Page は遷移の境界の内側に入り、共有 Layout はその外側に残ります。
まずアプリケーション全体の既定値を設定し、異なる動作が必要な Page だけで上書きします。

`PageViewTransition` を `@effront/core` から、`Layer` を `effect` から読み込みます。
`PageViewTransition` は既定値付きの Effect コンテキストです。
`Layer.succeed(PageViewTransition, config)` をアプリケーションの Layer に追加すると、共通設定を指定できます。

| 設定の範囲                   | 指定方法                                        |
| ---------------------------- | ----------------------------------------------- |
| アプリケーション全体の既定値 | `Layer.succeed(PageViewTransition, config)`     |
| 1 つの Page で上書き         | `Page.make({ viewTransition: config, render })` |
| 1 つの Page の境界を無効化   | `Page.make({ viewTransition: false, render })`  |

Page の `config` は、指定したプロパティだけを共通設定から上書きします。
指定できるプロパティは次のとおりです。

| プロパティ                                    | 指定できる値                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `enabled`                                     | 真偽値で、既定では有効です（`false` にすると境界を取り除きます）。                    |
| `default`、`enter`、`exit`、`update`、`share` | React ViewTransition のクラス名、`"auto"`、`"none"`、または遷移種別とクラスの対応表。 |

対応表は全体が置き換わり、共通設定の対応表とマージされません。
たとえば、Page の `default` の対応表は、アプリケーション全体の `default` の対応表を置き換えます。
遷移種別を追加するときに既存の項目も残したい場合は、置き換える対応表にそれらの項目も含めてください。
[ページ遷移のガイド](/advanced/client-navigation#transition-scope) では、この設定とリンクへの遷移種別の指定方法を説明しています。

設定はサーバーからクライアントへ渡るため、上記のシリアライズ可能な値だけを使います。
コールバックはこの設定に含めず、独自の React `ViewTransition` 境界に指定します。
`effront-page` はフレームワーク用に予約されているため、独自の境界には React の自動名か別の名前を使ってください。

アプリケーション全体が `enabled: false` でも、Page の `enabled: true` で境界を有効にできます。
Page の表示中に `enabled` を変えると境界が追加・削除され、ページ内の状態が再初期化される場合があります。
こうした変更をまたいで保持する必要がある状態は、共有 Layout に置いてください。
OS の「動きを減らす」設定は別の方法で扱われ、この設定が変わっても境界は残り、Page 内の入力状態は保持されます。
