## effrontTailwind {#plugin}

`@effront/tailwind` の `effrontTailwind()` を Vite の `plugins` に追加するだけで、標準の Tailwind CSS を使えます。
CSS ファイルの作成や import は不要です。

```typescript
effrontTailwind();
```

## stylesheet {#stylesheet}

テーマなどの Tailwind CSS 設定を変更したい場合にだけ、`EffrontTailwindOptions.stylesheet` に設定用 CSS ファイルのパスを指定します。

```typescript
effrontTailwind({ stylesheet: "./src/styles.css" });
```

パスは Vite root を基準に解決されます。
CSS ファイルには `@import "tailwindcss";` と、必要なテーマ設定などを記述してください。
指定したファイルは自動で読み込まれるため、コンポーネントからの import は不要です。

Tailwind クラスの変更と、指定した CSS ファイルの変更は HMR で反映されます。
テーマ設定や任意の Typography 追加は [スタイリングの手順](../guide/styling.md) を参照してください。
CSS の設定構文は [公式 Tailwind documentation](https://tailwindcss.com/docs/installation/using-vite) を参照してください。
