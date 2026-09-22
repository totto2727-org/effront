## effrontTailwind {#plugin}

`@effront/tailwind` の `effrontTailwind(options?: EffrontTailwindOptions): PluginOption[]` は、`@tailwindcss/vite` を含み、Tailwind CSS 4 のスタイルシートを一つ自動で読み込みます。
アプリケーションの Effront プラグインとホストアダプターに加えて、一度だけ登録します。

```typescript
import { effront } from "@effront/vite";
import { effrontCloudflare } from "@effront/cloudflare";
import { effrontTailwind } from "@effront/tailwind";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontCloudflare(), effrontTailwind()],
});
```

`@tailwindcss/vite` を別に登録しないでください。
オプションなしでは Tailwind の既定スタイルシートを生成します。
CSS ファイルやコンポーネントからの CSS インポートは不要です。
開発中のクラスとスタイルシートの変更は HMR で反映されます。
インストールとアプリケーションの例は [スタイリング](../guide/styling.md) を参照してください。

## stylesheet {#stylesheet}

`EffrontTailwindOptions.stylesheet?: string` は、生成されるスタイルシートの代わりに CSS エントリーを選びます。

| 値                     | 動作                                                   |
| ---------------------- | ------------------------------------------------------ |
| 省略または `undefined` | 既定のスタイルシートを生成して読み込む                 |
| 空でない文字列         | Vite root を基準に解決し、そのファイルを自動で読み込む |
| `""`                   | `effrontTailwind` の呼び出し時に `TypeError`           |

`effrontTailwind({ stylesheet: "./src/styles.css" })` を指定する場合、`src/styles.css` に Tailwind 自体を含める必要があります。

```css
@import "tailwindcss";
```

このインポートには、アプリケーションの依存関係に `tailwindcss` が必要です。
たとえば `vp add -D tailwindcss@4.3.3` で追加します。
指定したファイルは生成エントリーを置き換えるため、コンポーネントからの追加インポートは不要です。
[`@theme`](https://tailwindcss.com/docs/theme) や [`@plugin`](https://tailwindcss.com/docs/functions-and-directives) ディレクティブを記述できます。
Typography などのプラグインは別途インストールします。
Markdown の描画を含め、利用は任意です。
