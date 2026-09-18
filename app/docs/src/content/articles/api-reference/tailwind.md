## effrontTailwind {#plugin}

`@effront/tailwind` の `effrontTailwind(options?)` は Tailwind compile と CSS dependency を接続する Vite plugins を返します。
`EffrontTailwindOptions` は optional な `stylesheet` を持ちます。
登録は一度だけで、内包される `@tailwindcss/vite` を重複追加しません。

既定では Tailwind を import する virtual stylesheet を生成します。
Vite root を対象に utilities を検出し、描画される React client boundary に stylesheet を自動接続します。
初回 SSR にも依存が含まれ、手動 CSS import は不要です。
無関係な HTML や client boundary のない描画へ無条件に注入する機能ではありません。

## stylesheet {#stylesheet}

`effrontTailwind({ stylesheet: "./src/styles.css" })` は Vite root から解決した CSS を使います。
空のパスは拒否されます。
選択したファイルを自動ロードするので、再度 import しません。
Tailwind の import と利用する CSS plugin の宣言はファイル側に残します。
参照する `@tailwindcss/typography` などはアプリケーションへ追加してください。

utilities の更新と独自 stylesheet の HMR に対応します。
[スタイリングの手順](../guide/styling.md) と [公式 Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite) を参照してください。
