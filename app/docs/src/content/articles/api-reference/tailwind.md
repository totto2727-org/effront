## effrontTailwind {#plugin}

`@effront/tailwind` の `effrontTailwind(options?)` を Vite の `plugins` に登録すると、Tailwind CSS を使えます。
`EffrontTailwindOptions` には省略可能な `stylesheet` があります。
省略時は CSS ファイルの作成や import は不要です。

## stylesheet {#stylesheet}

`effrontTailwind({ stylesheet: "./src/styles.css" })` は Vite root から解決した CSS を使います。
指定したファイルをコンポーネントから import する必要はありません。
Tailwind の import と利用する CSS plugin の宣言はファイル側に残します。
参照する `@tailwindcss/typography` などはアプリケーションへ追加してください。

utilities の更新と独自 stylesheet の HMR に対応します。
[スタイリングの手順](../guide/styling.md) と [公式 Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite) を参照してください。
