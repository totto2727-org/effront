Markdown の記事を Effront アプリケーションのページとして表示し、記事へのリンクやローカルアセットの参照を公開 URL に解決できます。
この例では、`@effront/markdown` と Comark の React レンダラーで記事を表示します。

[はじめにのサンプル](./getting-started.md)を [http://127.0.0.1:1340](http://127.0.0.1:1340) で起動した状態で進めます。

## 記事を追加する {#setup}

コレクションとパーサー、React レンダラーをアプリケーションにインストールします。

```bash
vp add @effront/markdown@0.1.4 @comark/react@0.6.2
```

`src/content/intro.md` を作成します。

```markdown
# Introduction

Welcome to the manual.
```

Markdown は信頼できる作成者が管理するものに限ってください。
パーサーは HTML やコンポーネントを受け付けるため、利用者からの投稿をサニタイズする用途には使えません。
コレクションの import と解析処理はサーバー側のモジュールに置きます。
Cloudflare Workers では、ホスト設定で `nodejs_compat` を有効にしてください。

## コレクションを読み込む {#collection}

`src/manual.ts` を作成します。

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
});
```

これで `intro.md` を `/manual/intro` として検索できますが、アプリケーションのルートはまだ登録されません。
取り除かれるのは `.md` 拡張子だけです。
`index.md` は `/manual` ではなく `/manual/index` になります。

ローカルの画像やダウンロードファイルを使う場合は、`manual` より前に `assets` を定義し、コレクションの `assets` オプションとして渡します。

```typescript
const assets = import.meta.glob<string>("./**/*.{svg,png,jpg,pdf}", {
  base: "./content",
  query: "?url",
  import: "default",
  eager: true,
});
```

参照するアセットのファイル形式をすべて glob に含めてください。

## 記事を URL で表示する {#render}

[Getting started](./getting-started.md#application) のアプリケーションエントリーで、`EFFRONT`、RootLayout、HomePage、`Effect` の import を残します。
次の import と Page を追加します。

```tsx
import { MarkdownDocument } from "@comark/react/components/MarkdownDocument";
import { parseMarkdown } from "@effront/markdown";
import { manual } from "./manual";

const IntroPage = EFFRONT.Page.make({
  render: Effect.fn("IntroPage.render")(function* () {
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

default export を置き換え、ホームページとともに記事を登録します。

```tsx
export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout })
    .page("/", HomePage)
    .page("/manual/intro", IntroPage),
});
```

[http://127.0.0.1:1340/manual/intro](http://127.0.0.1:1340/manual/intro) を開くと、Layout の内側に記事が表示されます。
余白や色を加えるには [Styling](./styling.md) を参照してください。

次の記事には `src/content/details.md` を追加し、Page を `/manual/details` に登録します。
`intro.md` 内の `[Details](./details.md#example)` は `/manual/details#example` に解決されます。
アセットの相対参照は記事のディレクトリを基準に解決され、import 済みの URL を使います。
解決できない参照は `MarkdownError` になります。

catch-all ルートを使う場合は、[コレクションの完全な例](https://github.com/totto2727-org/effront/blob/main/examples/markdown/src/entry.effront.tsx)を参照してください。
HTTP middleware で要求された記事を検索し、`get()` が `undefined` を返したら描画前に 404 を返します。
上の固定ルートの例では、登録済みの記事が見つからない場合を設定ミスとして扱います。
コレクションや解析の失敗も、Effect のエラーチャネルで `MarkdownError` として返されます。

## 解析や表示を変更する {#authoring}

[Comark の構文](https://comark.dev)で記事を書き、`parseMarkdown(entry)` と [Effront の標準設定](../api-reference/markdown.md#parse)で解析します。
解析を変えるには、`parseMarkdown(entry, { linkify: false })` のように、第 2 引数に Comark の `ParserOptions` を渡します。

パーサープラグインを追加するには、`comark@0.6.2` を直接の依存関係としてインストールし、プラグインを import します。

```typescript
import toc from "comark/plugins/toc";

const document = yield * parseMarkdown(entry, { plugins: [toc()] });
```

この解析の呼び出しで、Page のジェネレーター内にある先ほどの呼び出しを置き換えます。
追加プラグインは Effront の標準プラグインの後に実行され、標準プラグインを置き換えるものではありません。
コンポーネントの差し替えには [Comark の React レンダラー](https://comark.dev/rendering/react)を使ってください。
解析に対応しているだけでは、Math や Mermaid を React で表示できません。
Comark 0.6.2 はそれらのコンポーネントを自動登録しません。
オプションと参照解決の規則は [Markdown リファレンス](../api-reference/markdown.md)を参照してください。
