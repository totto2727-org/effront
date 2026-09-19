トップページを作り、URL を割り当てて、ブラウザーで動かしてみましょう。
このガイドではローカルの Cloudflare Worker を使い、ページやアプリケーションサービスを増やす前に、ひととおり動く Effront アプリケーションを試します。
すでに別の実行環境を使う予定なら、対応する [プラットフォームのガイド](../platforms.md) でセットアップを進めてください。

## プロジェクトを準備する {#setup}

VitePlus のプロジェクトを用意し、アプリケーションのディレクトリで次のコマンドを実行します。
VitePlus のインストールとプロジェクトの初期設定は [VitePlus のガイド](https://viteplus.dev/guide/) を参照してください。

```bash
vp add @effront/core@0.1.4 effect@4.0.0-rc.112 @effect/platform-browser@4.0.0-rc.112
vp add react@19.3.0 react-dom@19.3.0
vp add -D @effront/vite@0.1.4 @effront/cloudflare@0.1.4 @vitejs/plugin-rsc@0.5.35 wrangler
```

指定したバージョンを変更する場合も、React と Effect は Effront の peer dependencies に合うものを使ってください。
RSC の連携には、`@vitejs/plugin-rsc` も明示的な開発依存として追加します。

## トップページを定義する {#application}

次の内容で `src/entry.effront.tsx` を作成します。
Effront のページでは、`render` 関数が React の描画内容を持つ Effect を返します。
このような固定の見出しなら、`Effect.succeed` で書けます。

```tsx
import { Effect } from "effect";
import { Application } from "@effront/core";

const EFFRONT = Application.effront();

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="ja">
        <body>
          <main>{children}</main>
        </body>
      </html>,
    ),
});

const HomePage = EFFRONT.Page.make({
  render: () => Effect.succeed(<h1>Hello, Effront</h1>),
});

export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage),
});
```

最後の `.page("/", HomePage)` がページの URL を決め、`RootLayout` がページの内容を HTML ドキュメントの中に配置します。
default export では、これらの定義をアプリケーションとしてまとめています。
後でファイルを分ける場合も、Layout・Page・Routes は同じ `EFFRONT` 値から作成してください。

## アプリケーションを Workers に接続する {#files}

ページは定義できましたが、HTTP リクエストを受け取る入口がまだ必要です。
`src/entry.workers.ts` を作り、アプリケーションの Fetch ハンドラーを Workers に公開します。

```typescript
import { createFetchHandler } from "@effront/core/workers";
import application from "./entry.effront";

export default { fetch: createFetchHandler(application) };
```

この実行環境向けに Vite でビルドできるよう、プロジェクトのルートに `vite.config.ts` を追加します。
次のプラグインは、ここまでで作成したエントリのファイル名をデフォルトで使います。

```typescript
import { effront } from "@effront/vite";
import { effrontCloudflare } from "@effront/cloudflare";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontCloudflare()],
});
```

`@vitejs/plugin-rsc` のインストールは必要ですが、このプラグイン一覧には自分で追加しないでください。
`effront()` が RSC と React の両方のプラグインを登録します。

Vite の設定と同じディレクトリに `wrangler.jsonc` を追加し、Worker の名前とエントリポイントを指定します。
ビルドしたブラウザー向けファイルを Workers から配信できるよう、`ASSETS` binding を残してください。

```json
{
  "name": "my-effront-app",
  "main": "src/entry.workers.ts",
  "compatibility_date": "2026-09-12",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "binding": "ASSETS" }
}
```

## 表示を確認して書き換える {#run}

同じアプリケーションのディレクトリから開発サーバーを起動します。

```bash
vp dev
```

ターミナルに表示された URL を開いてください。
トップページに `Hello, Effront` が表示されます。
`HomePage` のこの文章を書き換えて保存し、ページを再読み込みして自分の内容を確認してみましょう。
これでアプリケーションを作り込む準備ができました。
表示内容はページで、その外側のドキュメントはレイアウトで編集できます。

開発サーバーではなくビルド済みのアプリケーションを試すには、`vp dev` を終了して次を実行します。

```bash
vp build
vp exec wrangler dev --local --config dist/rsc/wrangler.json
```

ここでは生成された `dist/rsc/wrangler.json` を使います。
元の設定にあるソースのエントリではなく、ビルド済みの Worker を指定するためです。
Wrangler が表示する URL を開き、もう一度トップページを確認してください。

次の手順は、変更したい内容に合わせて選べます。
[ルーティング](./routes.md) ではページと URL を増やし、[スタイリング](./styling.md) では見た目を整えます。
環境変数やその他の Workers の設定を進める場合は、[Cloudflare のガイド](/platforms/cloudflare) に進んでください。
