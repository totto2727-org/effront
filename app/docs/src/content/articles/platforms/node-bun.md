Effront アプリケーションを Node.js または Bun の HTTP サーバーとして動かすには、`@effront/server` を使います。
まず Vite でアプリケーションを動かし、その後、ページとブラウザー用アセットを配信する独立したサーバーをビルドします。
本番用の例は localhost で起動するので、ほかのマシンに公開する前に動作を確認できます。

## サーバー統合をインストールする {#setup}

[はじめる](../guide/getting-started.md#application)で `src/entry.effront.tsx` に定義したアプリケーションを使います。
VitePlus の実行には、22.x 系の Node.js 22.18 以降、または Node.js 24.11 以降を使ってください。
React と Effect は[対応するパッケージのバージョン](../api-reference.md#versions)に揃えます。
そのアプリケーションにサーバーアダプターと Vite 統合を追加してください。

```bash
vp add @effront/server@0.1.4 @effect/platform-node@4.0.0-rc.112
vp add -D @effront/vite@0.1.4 @vitejs/plugin-rsc
```

本番用にどちらを選んでも開発環境は共通で、Bun に配置する場合も `@effect/platform-node` が必要です。
Bun 固有の依存は [Bun の起動手順](#bun)で追加します。

## Vite でアプリケーションを確認する {#entries}

`src/entry.rsc.ts` を作り、アダプターが読み込む HTTP ハンドラーを `handler` という名前で公開します。
開発中にこのエントリーの更新を受け入れるため、末尾の HMR 設定も含めてください。

```typescript
import { toHttpEffect } from "@effront/core/http";
import application from "./entry.effront";

export const handler = toHttpEffect(application);
if (import.meta.hot) import.meta.hot.accept();
```

`vite.config.ts` では、`effront()` の後にサーバーアダプターを登録します。

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

Vite が表示した URL を開いてページが表示されることを確かめ、ページを編集して更新が反映されることも確認します。
開発用のポートとアセット配信は Vite が管理するため、以下で設定する本番用ポートやアセットのマウントはこの手順には影響しません。

## 本番用アセットの配置を準備する {#assets}

ページを読み込み、ブラウザー上で操作できるようにするには、ページのレスポンスだけでなく JavaScript と CSS にもアクセスできる必要があります。
次の例では既定のビルド構成を使い、サーバーの起動ファイルを `dist/rsc/server.js`、ブラウザー用アセットを `dist/client/assets`、公開用ファイルの配信元を `dist/client` とします。
アセットのパスは、コマンドを実行するディレクトリではなく、ビルド済みサーバーモジュールを基準に解決します。

ビルド成果物の配置先を決めるときは、次の設定を合わせて確認してください。

- `assets.client.root` には生成されたブラウザー用アセットの場所を指定し、`assets.client.prefix` には `/assets/` などの専用 URL 名前空間を指定します。
  この名前空間にファイルが見つからない場合は、アプリケーションのルートに引き継がず 404 を返します。
- `assets.public.root` は、それ以外の公開用ファイルを完全一致で配信します。
  ディレクトリのインデックスファイルを探したり、SPA 用 HTML にフォールバックしたりはしません。
- 例の `immutable` キャッシュ設定は、ファイル名にハッシュを含む生成アセット向けです。
  同じ URL のまま内容が変わるファイルには使わないでください。

Vite の出力先や `base` を変えた場合は、これらのルートと client prefix も合わせて変更します。
ビルドを別の環境に移すときは、`server.js` だけでなく、SSR モジュールとブラウザー用アセットを含む成果物全体を配置してください。
配信するのは、信頼できるビルド成果物と公開用ファイルだけにしてください。
意図しないファイルを公開しないよう、シンボリックリンクの参照先を含めて配置内容を確認します。

## Node.js サーバーをビルドして起動する {#node}

`src/entry.server.ts` を作り、以下のリスナーとアセットのマウントを設定します。
開発時と同じ `handler` を読み込み、Effect のランタイムを通してネイティブの Node.js サーバーを起動します。

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

ソースのエントリーファイル名を変える場合は、`effrontServer({ rsc, server })` の `rsc` と `server` にそのパスを指定します。
既定値は `src/entry.rsc.ts` と `src/entry.server.ts` です。
アプリケーションをビルドしたら、生成されたサーバーを直接起動します。

```bash
vp build
node dist/rsc/server.js
```

`http://127.0.0.1:3000` を開き、ページの表示、クライアント側の操作、ページ間の移動を確認します。
JavaScript と CSS が正しく読み込まれることも確認してください。
アセットが見つからない場合は、リクエストされた URL を、設定した prefix と対応する root 配下のファイルに照らし合わせます。

`127.0.0.1` を明示しているため、接続できるのはローカルマシンだけです。
外部からの接続を受け付ける場合は、意図する公開範囲を確認してから、`hostname` を `"0.0.0.0"` などに変更してください。
リリース前の検証には[ビルド済みアプリケーションの受け入れ確認](../best-practices/testing.md#production)、API の詳細には [serve・withAssets のリファレンス](../api-reference/server.md)を参照してください。

## 本番用サーバーに Bun を使う {#bun}

同じアプリケーションを Bun で動かすには、ハンドラーとアセットのマウントはそのままに、本番用のランタイムを変更します。
Bun 1.4.2 以降が必要です。

`src/entry.server.ts` で `NodeRuntime` を `@effect/platform-bun` から読み込む `BunRuntime` に置き換え、`serve` を `@effront/server/bun` から読み込み、末尾を `Layer.launch, BunRuntime.runMain` に変更します。
続いて Bun 用の platform パッケージを追加し、再ビルドします。

```bash
vp add @effect/platform-bun@4.0.0-rc.112
vp build
bun dist/rsc/server.js
```

同じ localhost の URL で、今度は Bun が起動したサーバーの動作を確認します。
`vp dev` と `vp preview` は Node 互換の Vite ミドルウェアを使い、Bun の本番用サーバーは実行しません。
Bun 固有 API を使う処理は、`bun dist/rsc/server.js` で実行したビルド済みエントリーにリクエストして確認してください。
開発やプレビューでの成功は、この実際のランタイムでの確認の代わりにはなりません。
