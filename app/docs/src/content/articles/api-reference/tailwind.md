`effrontTailwind()` で Effront アプリに Tailwind CSS 4 を追加すると、コンポーネントでユーティリティクラスを使い始められます。
標準設定では CSS ファイルは不要です。
アプリ独自のテーマや追加の Tailwind プラグインが必要になったら、その設定を記述するスタイルシートを指定します。

## effrontTailwind で Tailwind を有効にする {#plugin}

Vite の設定ファイルで `@effront/tailwind` から `effrontTailwind` を import し、`plugins` 配列に `effrontTailwind()` を追加します。
既存の Effront とホストアダプターの設定は残してください。

**Vite 設定の抜粋: 既存の `plugins` 配列へ追加する**

```typescript
plugins: [
  // 既存の Effront とホストアダプターの設定はここに残します。
  effrontTailwind(),
],
```

これで Tailwind の標準スタイルシートが生成されて自動で読み込まれ、`className` で `p-4` や `text-xl` などのユーティリティクラスを使えるようになります。
スタイルシートの作成やコンポーネントからの CSS import は不要です。
インストールを含む一連の手順は、[スタイリング](../guide/styling.md) を参照してください。

**関数の仕様**

`effrontTailwind(options?: EffrontTailwindOptions)` は省略可能なオプションオブジェクトを受け取り、Vite 用の `PluginOption[]` を返します。
返されるプラグインには、Effront のスタイルシート連携に加えて `@tailwindcss/vite` が含まれます。
`effrontTailwind()` は一度だけ登録し、すでに `@tailwindcss/vite` を個別に登録している場合は、両方を追加するのではなく置き換えてください。

## stylesheet でカスタマイズする {#stylesheet}

テーマの定義や Tailwind プラグインの設定には、`EffrontTailwindOptions.stylesheet` を使います。
生成される標準スタイルシートの代わりに、独自の CSS ファイルを指定するオプションです。
独自のスタイルシートを使う前に、その中の `@import "tailwindcss"` を解決できるよう、アプリケーションに Tailwind をインストールしてください。

```bash
vp add -D tailwindcss@4.3.3
```

たとえば、次の呼び出しは Vite root を基準に `src/styles.css` を指定します。

```typescript
effrontTailwind({ stylesheet: "./src/styles.css" });
```

| `stylesheet` の値      | 動作                                                               |
| ---------------------- | ------------------------------------------------------------------ |
| 省略または `undefined` | Tailwind の標準スタイルシートを生成して読み込みます。              |
| 空ではない `string`    | Vite root を基準にパスを解決し、そのファイルを自動で読み込みます。 |
| `""`                   | `effrontTailwind` の呼び出し時に `TypeError` を投げます。          |

指定したファイルは標準の CSS エントリーへの追加ではなく、それに代わるエントリーになります。
Tailwind を読み込むために `@import "tailwindcss";` を残し、その後に独自の設定を記述してください。
このファイルも、コンポーネントからの import は不要です。

**テーマを定義する**

ブランドカラーをユーティリティクラスで使えるようにするには、`src/styles.css` に次の内容を記述します。

```css
@import "tailwindcss";

@theme {
  --color-brand: #2563eb;
}
```

これで文字色には `text-brand`、背景色には `bg-brand` を使えます。
開発中は、Tailwind クラスと指定したスタイルシートの変更が HMR で反映されます。
その他のテーマ設定は、Tailwind の [テーマのドキュメント](https://tailwindcss.com/docs/theme) を参照してください。

**必要に応じてプラグインを追加する**

Tailwind プラグインを使うと、アプリで利用できるスタイルを拡張できます。
使いたいプラグインをインストールし、そのドキュメントに従って、指定したスタイルシートで設定します。

たとえば Typography は、記事の内容を装飾するための `prose` クラスを提供します。
`vp add -D @tailwindcss/typography` でインストールし、スタイルシートに次の `@plugin` ディレクティブを追加します。

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

既存のテーマ設定は残したまま、記事を囲む要素に `prose` を指定すると、その中の見出しや段落にスタイルが適用されます。
Typography は任意の追加機能であり、Tailwind のユーティリティクラスや Markdown の表示に必須ではありません。
CSS の設定構文は、Tailwind の [関数とディレクティブ](https://tailwindcss.com/docs/functions-and-directives) を参照してください。
