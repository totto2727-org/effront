## 準備 {#setup}

まず [Platforms](../platforms.md) で実行環境を選びます。
以下は standalone Cloudflare の一通りの手順です。
Node.js / Bun を選ぶ場合も [共通のアプリケーション定義](#application) は同じで、その後は [専用の起動手順](../platforms/node-bun.md) へ進んでください。
VitePlusで管理するアプリケーションに、npmレジストリから必要なパッケージを追加します。 VitePlusの導入方法は [公式ガイド](https://viteplus.dev/guide/) を参照してください。

```bash
vp add @effront/core@0.1.3 effect@4.0.0-rc.112 @effect/platform-browser@4.0.0-rc.112
vp add react@19.3.0-canary-1d34f91d-20260909 react-dom@19.3.0-canary-1d34f91d-20260909
vp add -D @effront/vite@0.1.3 @effront/cloudflare@0.1.3 @vitejs/plugin-rsc@0.5.34 wrangler
```

ReactとEffectは、インストールするEffrontのpeer dependenciesに合うバージョンを使います。`@vitejs/plugin-rsc` は開発時の依存最適化でアプリケーションから直接解決するため、明示的に追加します。

## アプリケーションの構成 {#files}

```text
src/
  entry.workers.ts # Fetch ハンドラーを公開するエントリ
  entry.effront.tsx  # JSXを含むルートグラフ
vite.config.ts    # ビルドとホスト統合
wrangler.jsonc    # Cloudflareの設定
```

## アプリケーションを書く {#application}

同じ `EFFRONT` 値から Layout、Page、Routes を作り、`EFFRONT.make` で閉じます。 次の `src/entry.effront.tsx` はサービスを要求しないため `layer` は不要です。

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

`src/entry.effront.tsx` はアプリケーション定義を公開します。ブラウザーのhydration entryはEffrontが提供します。

## ビルド統合と実行 {#run}

`src/entry.workers.ts` にFetchハンドラーを定義します。

```typescript
import { createFetchHandler } from "@effront/core/workers";
import application from "./entry.effront";

export default { fetch: createFetchHandler(application) };
```

`vite.config.ts` でEffrontとCloudflareのプラグインを登録します。

```typescript
import { effront } from "@effront/vite";
import { effrontCloudflare } from "@effront/cloudflare";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontCloudflare()],
});
```

`wrangler.jsonc` にアプリケーション名とサーバーエントリを設定します。

```json
{
  "name": "my-effront-app",
  "main": "src/entry.workers.ts",
  "compatibility_date": "2026-09-12",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "binding": "ASSETS" }
}
```

アプリケーションのディレクトリから開発サーバーを起動します。

```bash
vp dev
```

ターミナルに表示されたURLを開くと `Hello, Effront` が表示されます。 ビルド済みのアプリケーションは次のコマンドで確認できます。

```bash
vp build
vp exec wrangler dev --local --config dist/rsc/wrangler.json
```

環境変数やホスト設定の詳細は [Cloudflare](/platforms/cloudflare) のページを参照してください。
