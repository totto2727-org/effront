Tailwind CSS のユーティリティクラスを使うと、コンポーネント内で Effront アプリの見た目を整えられます。
既存のアプリに Effront の連携プラグインを追加すれば、スタイルシートを作らずに Tailwind の標準設定で使い始められます。
共通のデザイン設定や Tailwind プラグインが必要になったら、後からスタイルシートを追加できます。

## Tailwind のクラスを使う {#setup}

アプリに連携パッケージをインストールします。

```bash
vp add -D @effront/tailwind@0.1.4
```

Vite の設定で `effrontTailwind` を import し、既存の `plugins` 配列に `effrontTailwind()` を追加します。
配列内の `effront()` とホストアダプターはそのまま残してください。
すでに `@tailwindcss/vite` が含まれている場合は、Tailwind の Vite 連携も含む `effrontTailwind()` に置き換えます。

```typescript
import { effrontTailwind } from "@effront/tailwind";

// 既存の effront() とホストアダプターは維持します。
// plugins: [effrontTailwind(), effront(), hostAdapter()]
```

これでコンポーネントの `className` で見た目を指定でき、`p-4` で内側の余白を付けたり、`text-xl` で文字を大きくしたりできます。
この設定では、CSS ファイルの作成やコンポーネントからの CSS import は不要です。
標準のクラスで必要なデザインを表現できる間は、そのまま使い続けられます。

## テーマに共通の値を定義する {#stylesheet}

アプリ独自の色やフォントを複数のコンポーネントで共有したい場合は、テーマ用のスタイルシートにまとめて定義します。
独自のスタイルシートを使う場合は、Tailwind をインストールします。

```bash
vp add -D tailwindcss@4.3.3
```

例えば、ブランドカラーを定義する `src/styles.css` を作成します。

```css
@import "tailwindcss";

@theme {
  --color-brand: #2563eb;
}
```

既存の `effrontTailwind()` の `stylesheet` オプションで、このファイルを指定します。

```typescript
effrontTailwind({ stylesheet: "./src/styles.css" });
```

パスは Vite root を基準に指定します。
指定したファイルが標準のスタイルシートに代わるため、Tailwind のスタイルを読み込む `@import "tailwindcss";` の行は残してください。
指定したファイルは Effront が自動で読み込みます。
コンポーネントに CSS import を追加する必要はありません。

これで、文字色には `text-brand`、背景色には `bg-brand` でブランドカラーを指定できます。
Tailwind の標準クラスと同じように、`className` で使ってください。

## プラグインでスタイルを追加する {#scope}

標準のユーティリティやテーマだけでは足りないスタイルは、必要に応じて Tailwind プラグインで追加できます。
使いたいプラグインをインストールし、そのドキュメントに従って、`stylesheet` で指定したファイルに `@plugin` などの設定を記述します。
まだ標準設定を使っている場合は、先ほどの手順でスタイルシートを作成して指定してください。
独自のテーマ値を追加せずに、プラグインだけを利用することもできます。

例えば、記事の見出しや段落、リスト、リンクの見た目をまとめて整えたい場合には、Typography が選択肢になります。
利用する場合は、プラグインをインストールします。

```bash
vp add -D @tailwindcss/typography
```

次に、指定したスタイルシートで有効にします。

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

ファイルにテーマの設定がある場合は、その設定を残して `@plugin` の行を追加します。
記事を囲む要素に `prose` を指定すると、その中の文章にスタイルが適用されます。
Typography はあくまで一例であり、Effront アプリのスタイリングや Markdown の表示に必須ではありません。

連携プラグインの設定項目は [Tailwind API](../api-reference/tailwind.md) を参照してください。
ユーティリティクラス、テーマの構文、さらに詳しいカスタマイズについては、[Tailwind CSS 公式ドキュメント](https://tailwindcss.com/docs/installation/using-vite) を参照してください。
