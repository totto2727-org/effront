## 標準設定で使う {#setup}

`effrontTailwind()` を Vite の `plugins` に追加するだけで、標準の Tailwind CSS を使えます。
CSS ファイルの作成やコンポーネントからの CSS import は不要です。

```bash
vp add -D @effront/tailwind@0.1.4
```

既存の Vite config に追加します。

```typescript
import { effrontTailwind } from "@effront/tailwind";

// 既存の effront() とホストアダプターは維持します。
// plugins: [effrontTailwind(), effront(), hostAdapter()]
```

あとはコンポーネントの `className` に `p-4` や `text-xl` などのクラスを指定します。
すでに `@tailwindcss/vite` を登録している場合は、`effrontTailwind()` に置き換えてください。

## テーマなどを設定する {#stylesheet}

色やフォントなど、Tailwind CSS の設定を変更したい場合は CSS ファイルを用意し、そのパスを `stylesheet` に渡します。
例えば `src/styles.css` に独自の色を追加します。

```css
@import "tailwindcss";

@theme {
  --color-brand: #2563eb;
}
```

```typescript
effrontTailwind({ stylesheet: "./src/styles.css" });
```

パスは Vite root を基準に指定します。
この例では `text-brand` や `bg-brand` を使えるようになります。
指定した CSS は自動で読み込まれるため、コンポーネントからの import は不要です。

## プラグインを追加する {#scope}

Tailwind の追加プラグインも、`stylesheet` で指定した CSS ファイルから設定します。
使いたいプラグインをインストールし、そのプラグインの手順に従って CSS に `@plugin` などを記述してください。
標準の Tailwind クラスを使うだけなら、追加プラグインは不要です。

例えば、文章向けのスタイルを提供する Typography を選ぶ場合は、次のように追加します。

```bash
vp add -D @tailwindcss/typography
```

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

この例では `prose` クラスを使えます。
Typography は追加プラグインの一例で、Effront や Markdown の利用に必須ではありません。
設定方法は [Tailwind API](../api-reference/tailwind.md) と [公式 Tailwind documentation](https://tailwindcss.com/docs/installation/using-vite) を参照してください。
