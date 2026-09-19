## 準備とホストの選択 {#setup}

`@effront/server` は Node.js と Bun の native Effect HTTP ホストです。
Fetch shim を介さず、リクエスト Scope とストリームを Effect の HTTP サーバーへ接続します。
共通のアプリケーションは [はじめる](../guide/getting-started.md#application) の `entry.effront.tsx` を使えます。
Workers 用の `entry.workers.ts` と Wrangler 設定は不要です。

[公開パッケージのバージョンと peer requirements](../api-reference.md#versions) を揃え、Node.js 用には次を追加します。

```bash
vp add @effront/server@0.1.3 @effect/platform-node@4.0.0-rc.112
vp add -D @effront/vite@0.1.3 @vitejs/plugin-rsc
```

Vite tooling には Node.js 22 以降を使います。
Bun production には Bun 1.4.2 以降と `@effect/platform-bun@4.0.0-rc.112` を追加します。
Bun 1.3.13 は現在の React SSR 出力を解釈できません。
Bun 構成でも Vite の `/vite` エントリーには `@effect/platform-node` が必要です。

## アプリケーションとビルド {#entries}

`src/entry.rsc.ts` は名前付きの `handler` を公開します。

```typescript
import { toHttpEffect } from "@effront/core/http";
import application from "./entry.effront";

export const handler = toHttpEffect(application);
if (import.meta.hot) import.meta.hot.accept();
```

`vite.config.ts` で共通コンパイラーの後にホスト統合を登録します。

```typescript
import { effront } from "@effront/vite";
import { effrontServer } from "@effront/server/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontServer()],
});
```

`effrontServer({ rsc?, server? })` の既定値は `src/entry.rsc.ts` と `src/entry.server.ts` です。
RSC と SSR は別のグラフです。
`NODE_OPTIONS=--conditions=react-server` をプロセス全体に設定しません。

## Node.js で起動する {#node}

`src/entry.server.ts` にリスナーと静的アセットのマウントを定義します。
以下は既定の `dist/rsc/server.js` と `dist/client/assets` を前提にした相対パスです。

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

```bash
vp dev
# ビルド後は Vite と独立して起動する
vp build
node dist/rsc/server.js
```

`http://127.0.0.1:3000` を開いて HTML、hydration、リンク移動を確認します。
開発サーバーのポートは Vite の設定に従います。
外部へ公開する場合だけ、公開範囲を確認して `hostname: "0.0.0.0"` などを明示します。

## Bun で起動する {#bun}

同じ構成で、production entry の `NodeRuntime` を `@effect/platform-bun` の `BunRuntime` に、`serve` の import を `@effront/server/bun` に変更します。
末尾は `Layer.launch, BunRuntime.runMain` です。

```bash
vp add @effect/platform-bun@4.0.0-rc.112
vp build
bun dist/rsc/server.js
```

`vp dev` と `vp preview` は Bun production server ではなく Node 互換の Vite ミドルウェアです。
Bun 固有 API の受け入れ確認には必ずビルド済み Bun entry を使います。

## 静的ファイルと運用境界 {#assets}

client prefix 配下のファイルが見つからない場合は 404 で、アプリケーションルートへフォールバックしません。
public files は完全一致だけで、ディレクトリ index や SPA fallback はありません。
出力先や Vite base を変えたら、明示的なマウントの root と prefix も合わせてください。
配信先には信頼できるビルド成果物と public directory だけを置きます。
シンボリックリンクを含む配置内容の管理は利用者の責任です。

詳細は [serve・withAssets の契約](../api-reference/server.md) と [ビルドと起動の契約](../platforms.md#build-startup) を参照してください。
