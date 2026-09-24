Effront の Tailwind 統合でコンポーネントにスタイルを付け、アプリケーション全体でテーマを共有できます。
Tailwind の標準ユーティリティを使う場合も、独自のテーマ値やプラグインを記述したスタイルシートを使う場合も、統合がスタイルシートを読み込みます。

## Tailwind のユーティリティを使う {#setup}

統合パッケージをインストールします。

```bash
vp add -D @effront/tailwind@0.1.4 @tailwindcss/vite@4.3.3 tailwindcss@4.3.3
```

[Getting started](./getting-started.md) の `vite.config.ts` に、`effrontTailwind()` を追加します。

```typescript
// vite.config.ts
import { effrontServer } from "@effront/server/vite";
// Added: Tailwind integration.
import { effrontTailwind } from "@effront/tailwind";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  // Added: effrontTailwind().
  plugins: [effront(), effrontServer(), await effrontTailwind()],
  server: { host: "127.0.0.1", port: 1340, strictPort: true },
});
```

> [!IMPORTANT]
> `effrontTailwind()` は `@tailwindcss/vite` を含むため、別に登録している場合は取り除いてください。

スタイルシートや、コンポーネントからの CSS import は不要です。

コンポーネントの JSX でユーティリティを使います。

```tsx
<h1 className="p-4 text-xl font-bold">Hello</h1>
```

見出しに余白が付き、文字が大きく太くなります。

## スタイルシートでテーマを定義する {#stylesheet}

共通の色などのテーマ値を追加するには、`src/styles.css` を作成します。

```css
@import "tailwindcss";

@theme {
  --color-brand: #2563eb;
}
```

`vite.config.ts` で、`effrontTailwind()` にスタイルシートを指定します。

```typescript
// vite.config.ts: replace effrontTailwind() in the plugins array.
await effrontTailwind({ stylesheet: "./src/styles.css" });
```

パスは Vite root を基準にします。
このファイルが標準のスタイルシートを置き換えるため、`@import "tailwindcss";` は残してください。
Effront が自動で読み込むので、コンポーネントからの import は不要です。
新しい色は `text-brand` や `bg-brand` で使えます。

## 必要に応じて Tailwind プラグインを追加する {#scope}

プラグインをインストールし、そのドキュメントに従って、選択済みのスタイルシートに設定します。
例えば、Typography は記事本文のスタイルを追加します。

```bash
vp add -D @tailwindcss/typography
```

`src/styles.css` の既存の import とテーマを残し、Typography プラグインを追加します。

```css
/* src/styles.css: add the plugin after the existing import. */
@import "tailwindcss";
/* Added: Typography plugin. */
@plugin "@tailwindcss/typography";
/* Keep the existing @theme block below. */
```

記事を `<article className="prose">` で囲むと、見出し、段落、リストにスタイルが付きます。
Typography は任意の追加機能であり、Markdown の表示に必須ではありません。

統合のオプションは [Tailwind API](../api-reference/tailwind.md)、ユーティリティやテーマ構文は [Tailwind CSS ドキュメント](https://tailwindcss.com/docs/installation/using-vite)を参照してください。
