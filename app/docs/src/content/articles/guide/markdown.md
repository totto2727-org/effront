## Markdown を選ぶ {#setup}

`@effront/markdown` は Vite が読み込んだ文書から collection を作り、Comark の標準 document を返します。
記事本文は Markdown、ルーティング・レイアウト・ナビゲーションはアプリケーションで管理します。
このサイトも一般記事にはこの構成を使い、正確なソース抜粋を含む実装解説には JSX を残しています。

```bash
vp add @effront/markdown@0.1.4 @comark/react@0.6.2
```

collection と parser の import はサーバーグラフに置いてください。

## Vite の collection {#collection}

`src/manual.ts` の隣に `src/content/intro.md` と `src/content/details.md` を置きます。
`intro.md` に `[詳細](./details.md#example)` と書くと、公開 URL は `/manual/details#example` になります。

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

両方の glob は同じ `base` を使います。
Vite が raw text と asset URL を用意し、collection が相対参照を解決します。
`intro.md` は `/manual/intro`、`index.md` は `/manual/index` です。
index の暗黙 alias はありません。`/` などの別 URL はアプリケーションが明示的に対応させます。

## Page の Effect で描画する {#render}

collection の `get()` は未登録 URL に `undefined` を返します。
以下は明示的な `/manual/intro` Page の例で、未登録のルートは通常の Effront 404 です。
`EFFRONT` と RootLayout は [はじめる](./getting-started.md#application) と同じ値を使い、`Routes.page("/manual/intro", IntroPage)` へ登録します。

```tsx
import { MarkdownDocument } from "@comark/react/components/MarkdownDocument";
import { parseMarkdown } from "@effront/markdown";
import { Effect } from "effect";
import { manual } from "./manual";

const IntroPage = EFFRONT.Page.make({
  render: () =>
    Effect.gen(function* () {
      const collection = yield* manual;
      const entry = collection.get("/manual/intro");
      if (!entry) throw new TypeError("Registered article is missing");
      const document = yield* parseMarkdown(entry);
      return (
        <article className="prose">
          <MarkdownDocument value={document} />
        </article>
      );
    }),
});
```

catch-all ルートでは HTTP middleware で lookup し、見つからなければ描画・streaming の開始前に 404 を返してください。
[完全な collection example](https://github.com/totto2727-org/effront/blob/main/examples/markdown/src/entry.effront.tsx) は request-local な記事選択を示しています。
collection と parse の失敗は `MarkdownError`、通常の lookup miss は `undefined` です。

## 見出し・コード・スタイル {#authoring}

Comark の属性構文で `## セットアップ {#setup}` のように安定した ID を付けると、目次や外部リンクの対象を保てます。
fenced code block の言語を指定すると、既定の Shiki plugin がサーバー側で token を生成します。
スタイルはアプリケーションの責任です。
[Tailwind と Typography](./styling.md) を組み合わせるか、独自の CSS を用意します。
標準 renderer の `components` で `ProseA` などを置き換えることもできます。

Markdown は信頼できる著者のコンテンツとして扱います。
HTML・components・attributes が有効なので、未信頼投稿を sanitize する境界ではありません。
Math と Mermaid の parser plugin はありますが、Comark 0.6.2 の標準 React renderer は対応 component を自動登録しません。
完全な Math / Mermaid SSR が提供されると仮定しないでください。
API の詳細と参照の制約は [Markdown reference](../api-reference/markdown.md) にまとめています。
