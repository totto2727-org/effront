## Tailwind の統合 {#setup}

`@effront/tailwind` は optional な Vite 統合です。
既定の stylesheet を生成し、描画される React client boundary を通じて初回 SSR にも CSS を含めます。
手動の CSS import は不要です。

```bash
vp add -D @effront/tailwind@0.1.4
```

既存の Vite config へ `effrontTailwind()` を一度だけ追加します。

```typescript
import { effrontTailwind } from "@effront/tailwind";

// 既存の effront() とホストアダプターは維持します。
// plugins: [effrontTailwind(), effront(), hostAdapter()]
```

公式 `@tailwindcss/vite` plugin を内包するので、別途二重登録しません。
Tailwind の utilities はアプリケーション root から検出されます。
この統合は描画される client boundary のない無関係な HTML へ自動で CSS を注入するものではありません。

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

Vite root 基準のパスを指定すると、生成 stylesheet の代わりにこのファイルが自動ロードされます。
コンポーネントから再度 import しないでください。

```typescript
effrontTailwind({ stylesheet: "./src/styles.css" });
```

本文を `className="prose dark:prose-invert"` の要素に置き、必要な theme や余白を CSS で調整します。
[Markdown guide](./markdown.md) の renderer 自体は Typography を強制しません。
JavaScript を無効にした初回 HTML でも CSS が読み込まれることを確認してください。

## 責務の境界 {#scope}

この plugin は Tailwind の compile と CSS dependency の接続を担当します。
色テーマ、dark mode の選択、記事の layout はアプリケーションが所有します。
詳細は [Tailwind API](../api-reference/tailwind.md)、一般の CSS 構文は [公式 Tailwind documentation](https://tailwindcss.com/docs/installation/using-vite) を参照してください。
