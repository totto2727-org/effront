## サーバー統合をインストールする {#setup}

[はじめる](../guide/getting-started.md#application)で用意した依存パッケージと `src/entry.effront.tsx` のアプリケーションを使います。
VitePlus の実行には、22.x 系の Node.js 22.18 以降、または Node.js 24.11 以降を使ってください。
React と Effect は[対応するパッケージのバージョン](../api-reference.md#versions)に揃えます。

```bash
vp add @effront/server@0.1.4 @effect/platform-node@4.0.0-rc.112
```

[本番に Bun を使う](#bun)場合も、開発には `@effect/platform-node` が必要です。

## Vite でアプリケーションを確認する {#entries}

`src/entry.rsc.ts` を作り、`handler` の名前付き export と HMR の更新を受け入れる文を追加します。

```typescript
import { toHttpEffect } from "@effront/core/http";
import application from "./entry.effront";

export const handler = toHttpEffect(application);
if (import.meta.hot) import.meta.hot.accept();
```

`vite.config.ts` を作り、`effront()` の後に `effrontServer()` を登録します。

```typescript
import { effront } from "@effront/vite";
import { effrontServer } from "@effront/server/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontServer()],
});
```

```bash
vp dev
```

表示された URL を開き、トップページを確認します。
見出しを編集して保存し、開発中の更新も確認してください。
開発用アセットの配信とポートは Vite が管理するため、以下の本番設定とは独立しています。

## 本番用アセットの配置を準備する {#assets}

以下の起動例では、既定の出力先を使います。

| ファイルまたはディレクトリ | 用途                                                |
| -------------------------- | --------------------------------------------------- |
| `dist/rsc/server.js`       | サーバーの起動                                      |
| `dist/client/assets`       | 生成された JavaScript と CSS。`/assets/` 配下で配信 |
| `dist/client`              | ファイルの完全一致で配信する公開用ファイル          |

Vite の出力先や `base` を変える場合は、アセットの root と client prefix も合わせて変更してください。
client prefix 配下のファイルが見つからない場合は 404 を返します。
公開用ファイルには、ディレクトリのインデックスや SPA へのフォールバックはありません。
`immutable` キャッシュは、ファイル名にハッシュを含む生成アセットにだけ適用してください。

ビルドを移す際は、SSR モジュールとブラウザー用アセットを含む成果物全体を配置します。
信頼できるビルド用・公開用ディレクトリだけを配信し、意図しないファイルを公開しないようシンボリックリンクの参照先も確認してください。

## Node.js サーバーをビルドして起動する {#node}

`src/entry.server.ts` を作成します。

```typescript
import { NodeRuntime } from "@effect/platform-node";
import { serve } from "@effront/server/node";
import { Layer } from "effect";
import { fileURLToPath } from "node:url";
import { handler } from "./entry.rsc";

serve(handler, {
  port: 3000,
  hostname: "127.0.0.1",
  assets: {
    client: {
      root: fileURLToPath(new URL("../client/assets", import.meta.url)),
      prefix: "/assets/",
      cacheControl: "public, max-age=31536000, immutable",
    },
    public: { root: fileURLToPath(new URL("../client", import.meta.url)) },
  },
}).pipe(Layer.launch, NodeRuntime.runMain);
```

アセットのパスは、コマンドの実行ディレクトリではなく、生成された `dist/rsc/server.js` を基準に解決します。
ソースのエントリー名を変えた場合は、`effrontServer({ rsc, server })` にそのパスを指定してください。

```bash
vp build
node dist/rsc/server.js
```

`http://127.0.0.1:3000` を開き、ページの表示、JavaScript と CSS の読み込み、クライアント側の操作、ページ間の移動を確認します。
アセットが見つからない場合は、リクエストされた URL を設定した prefix と root ディレクトリに照らし合わせてください。

`127.0.0.1` ではローカル接続だけを受け付けます。
`hostname` を `"0.0.0.0"` に変える前に、意図する公開範囲を確認してください。
リリース前には[ビルド済みアプリケーションの確認](../best-practices/testing.md#production)、その他のオプションには[サーバー API リファレンス](../api-reference/server.md)を参照してください。

## 本番用サーバーに Bun を使う {#bun}

Bun 1.4.2 以降が必要です。
`src/entry.server.ts` のハンドラーとアセットのマウントは残し、次のように変更します。

1. `NodeRuntime` の import を `import { BunRuntime } from "@effect/platform-bun"` に置き換えます。
2. `serve` の import 元を `"@effront/server/node"` から `"@effront/server/bun"` に変えます。
3. パイプラインの末尾を `.pipe(Layer.launch, BunRuntime.runMain)` に変えます。

Bun 用の platform パッケージをインストールし、再ビルドして起動します。

```bash
vp add @effect/platform-bun@4.0.0-rc.112
vp build
bun dist/rsc/server.js
```

Bun のサーバーで同じ localhost の URL を確認してください。
`vp dev` と `vp preview` は Node 互換の Vite ミドルウェアを使うため、Bun 固有の動作はビルド済みエントリーを Bun で実行して検証します。
