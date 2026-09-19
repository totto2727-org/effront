記事本文をアプリケーションのページコンポーネントとは分けて編集したいときは、Markdown を使えます。
`@effront/markdown` を使うと、プロジェクト内のファイルを Page に表示し、ほかの記事やアセットへのリンクも解決できます。
記事を表示する URL と、その記事を囲むレイアウトはアプリケーションで決めます。

まずは1つの記事を `/manual/intro` に表示しましょう。
表示できたら、Page の描画コードを置き換えることなく、リンク先の記事を増やしたり Markdown の解析方法を変えたりできます。

## 最初の記事を用意する {#setup}

このガイドでは、[はじめる](./getting-started.md#application)で示した `EFFRONT` と RootLayout を含む Effront アプリケーションがあることを前提とします。
collection と parser のパッケージ、および解析結果を表示する React コンポーネントを追加します。

```bash
vp add @effront/markdown@0.1.4 @comark/react@0.6.2
```

`src/content/intro.md` を作り、公開したい記事を書きます。
Markdown の構文は [Comark ドキュメント](https://comark.dev)を参照してください。
parser は未信頼の投稿を安全化する機能ではないため、信頼できる著者が管理するコンテンツを使ってください。

collection と parser は Client Component ではなく、サーバー側のモジュールで扱います。
Cloudflare Workers では、ホストの設定で `nodejs_compat` を有効にしてください。

## Page から記事を取得できるようにする {#collection}

`content` ディレクトリの隣に `src/manual.ts` を作ります。
次の collection は Markdown ファイルに `/manual` の URL プレフィックスを対応させ、読み込んだアセットを相対リンクから参照できるようにします。

```typescript
import { createMarkdownCollection } from "@effront/markdown";

export const manual = createMarkdownCollection({
  basePath: "/manual",
  documents: import.meta.glob<string>("./**/*.md", {
    base: "./content",
    query: "?raw",
    import: "default",
    eager: true,
  }),
  assets: import.meta.glob<string>("./**/*.{svg,png,jpg,pdf}", {
    base: "./content",
    query: "?url",
    import: "default",
    eager: true,
  }),
});
```

`documents` は各記事の本文を、`assets` は画像やダウンロード用ファイルの URL を読み込みます。
共通のコンテンツディレクトリを基準に参照を解決できるよう、両方の glob に同じ `base` を使ってください。
記事がローカルのアセットを参照しない場合は、`assets` を省略できます。

この collection では、`intro.md` を `/manual/intro` として取得できます。
ただし、取得できるようになっただけなので、次にアプリケーションのルートと結び付けます。

## 記事を表示し、関連ページをつなぐ {#render}

`src/entry.effront.tsx` では、「はじめる」で作成した `EFFRONT`、`RootLayout`、`HomePage` と `Effect` の import を残します。
次の import を追加し、default export より前に `IntroPage` を定義します。
この Page は記事を選択し、Effect 内で解析して、その結果を Comark の `MarkdownDocument` に渡します。

```tsx
import { MarkdownDocument } from "@comark/react/components/MarkdownDocument";
import { parseMarkdown } from "@effront/markdown";
import { manual } from "./manual";

const IntroPage = EFFRONT.Page.make({
  render: () =>
    Effect.gen(function* () {
      const collection = yield* manual;
      const entry = collection.get("/manual/intro");
      if (!entry) throw new TypeError("Registered article is missing");
      const document = yield* parseMarkdown(entry);
      return (
        <article>
          <MarkdownDocument value={document} />
        </article>
      );
    }),
});
```

既存の default export を、次のルート登録に置き換えます。
ホームページを残したまま、記事のルートを追加できます。

```tsx
export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout })
    .page("/", HomePage)
    .page("/manual/intro", IntroPage),
});
```

`/manual/intro` を開き、レイアウトの中に記事本文が表示されることを確認してください。
余白や色などの見た目を変える場合は、[スタイリング](./styling.md)に進んでください。

2つ目の記事をつなぐには、`src/content/details.md` を追加し、同じ方法で `/manual/details` の Page を登録します。
`intro.md` に `[詳細](./details.md#example)` と書いたリンクは、`/manual/details#example` を指します。
画像やファイルへの相対参照も collection に読み込んだアセットを使うため、参照先の各ファイルを対応する glob に含めてください。

ルートを決めるときは、collection がファイル名から取り除くのは `.md` だけであることに注意してください。
`index.md` は `/manual` ではなく `/manual/index` に対応します。
別の URL を使うには、アプリケーションのルートと該当する文書を明示的に対応させます。

記事が増えた場合は、[collection の実装例](https://github.com/totto2727-org/effront/blob/main/examples/markdown/src/entry.effront.tsx)のように、記事ごとのルート登録を catch-all ルートに置き換えられます。
その場合は HTTP middleware でリクエストされた記事を探し、見つからなければ描画やストリーミングの開始前に 404 を返してください。
記事が見つからない場合、`get()` は `undefined` を返しますが、collection の作成・解析・参照の解決に失敗した場合は Effect のエラーチャネルに `MarkdownError` が返ります。
上の固定ルートの例では、`intro.md` が欠けていることを、訪問者が未知の URL を指定したケースではなく設定ミスとして扱っています。

## 標準設定を使い、必要に応じて解析を変える {#authoring}

上の Page では parser の設定は不要で、`parseMarkdown(entry)` が [Effront の標準設定](../api-reference/markdown.md#parse)を使います。
まずはこの設定を使い、変更したい項目があるときに Comark の `ParserOptions` を第2引数に渡してください。
例えば URL の自動リンク化は次のように無効にできます。

```typescript
const document = yield * parseMarkdown(entry, { linkify: false });
```

解析機能を追加するには、同じオプションのオブジェクトでプラグインを指定します。
次の例では Comark の目次プラグインを追加しています。

```typescript
import toc from "comark/plugins/toc";

const document = yield * parseMarkdown(entry, { plugins: [toc()] });
```

Comark のプラグインを直接 import する場合は、アプリケーションの依存関係に `comark@0.6.2` を追加してください。
指定したプラグインは Effront の既定プラグインの後に追加され、既定プラグインを削除・置き換えするものではありません。

parser のオプションは文書の生成方法を、コンポーネントのマッピングは表示方法を制御します。
描画用コンポーネントの変更は [Comark の React renderer ドキュメント](https://comark.dev/rendering/react)、Effront の API と参照の解決に関する制約は [Markdown reference](../api-reference/markdown.md)を参照してください。
