`Hello, Effront` を表示するトップページを作り、選んだ実行環境で動かします。

## プロジェクトを準備する {#setup}

[VitePlus のプロジェクト](https://viteplus.dev/guide/)に、Effront と共通の依存パッケージをインストールします。

```bash
vp add @effront/core@0.1.4 effect@4.0.0-rc.112 @effect/platform-browser@4.0.0-rc.112
vp add react@19.3.0 react-dom@19.3.0
vp add -D @effront/vite@0.1.4 @vitejs/plugin-rsc@0.5.35
```

バージョンを変更する場合は、Effront の [peer dependencies](../api-reference.md#versions) に揃えてください。

## トップページを定義する {#application}

`src/entry.effront.tsx` を作成します。

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

`render` コールバックは、見出しを含む Effect を返します。
`RootLayout` はページを HTML ドキュメントで囲み、`.page("/", HomePage)` はトップページの URL を割り当てます。
ファイルを分ける場合も、Layout、Page、Routes は同じ `EFFRONT` 値から作成してください。

## アプリケーションを実行環境に接続する {#files}

[プラットフォームのセットアップ](../platforms.md)を一つ選び、実行環境のエントリーと `vite.config.ts` を追加して、開発サーバーを起動します。

- [Cloudflare Workers](../platforms/cloudflare.md#setup): Wrangler の設定でローカル実行します。この例では Cloudflare アカウントは不要です。
- [Node.js / Bun](../platforms/node-bun.md#setup): 開発には Vite、本番にはネイティブのサーバーを使います。
- [Alchemy](../platforms/alchemy.md#setup): Worker とリソースをコードで管理します。設定済みの Cloudflare profile が必要です。

## 表示を確認して書き換える {#run}

ターミナルに表示された開発用 URL を開き、`/` にアクセスします。
`Hello, Effront` が表示されます。
`HomePage` のこの文字列を書き換えて保存し、再読み込みして新しい見出しを確認してください。
