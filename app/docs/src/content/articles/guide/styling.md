## Tailwind の統合 {#setup}

`@effront/tailwind` を追加すると、CSS ファイルの作成や import なしで Tailwind のクラスを使えます。

```bash
vp add -D @effront/tailwind@0.1.4
```

既存の Vite config へ `effrontTailwind()` を一度だけ追加します。

```typescript
import { effrontTailwind } from "@effront/tailwind";

// 既存の effront() とホストアダプターは維持します。
// plugins: [effrontTailwind(), effront(), hostAdapter()]
```

すでに `@tailwindcss/vite` を登録している場合は、`effrontTailwind()` に置き換えてください。

## 独自 stylesheet と記事の Typography {#stylesheet}

Markdown や説明文には Tailwind Typography を使えます。

```bash
vp add -D @tailwindcss/typography
```

`src/styles.css` に Tailwind と必要な plugin を記述します。

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

`stylesheet` に Vite root 基準のパスを指定します。
コンポーネントからの CSS import は不要です。

```typescript
effrontTailwind({ stylesheet: "./src/styles.css" });
```

本文を `className="prose dark:prose-invert"` の要素に置き、必要な theme や余白を CSS で調整します。
記事の表示方法は [Markdown guide](./markdown.md) を参照してください。

## テーマとレイアウト {#scope}

色テーマ、ダークモード、レイアウトは Tailwind のクラスや CSS で設定できます。
詳細は [Tailwind API](../api-reference/tailwind.md)、一般の CSS 構文は [公式 Tailwind documentation](https://tailwindcss.com/docs/installation/using-vite) を参照してください。
