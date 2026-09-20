## アプリケーションを Worker に接続する {#setup}

[はじめる](../guide/getting-started.md)で用意した依存パッケージと `src/entry.effront.tsx` のアプリケーションを使います。
Workers アダプターと Wrangler を追加します。

```bash
vp add -D @effront/cloudflare@0.1.4 wrangler
```

`src/entry.workers.ts` を作成します。

```typescript
import { createFetchHandler } from "@effront/core/workers";
import application from "./entry.effront";

export default { fetch: createFetchHandler(application) };
```

## Worker とビルドを設定する {#vite}

プロジェクトのルートに `wrangler.jsonc` を作成します。

```json
{
  "name": "my-effront-app",
  "main": "src/entry.workers.ts",
  "compatibility_date": "2026-09-12",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "binding": "ASSETS" }
}
```

`nodejs_compat` と `ASSETS` binding を残してください。
ブラウザー用アセットのディレクトリは、ビルド時に生成される Wrangler 設定に含まれます。

`vite.config.ts` を作成します。

```typescript
import { effront } from "@effront/vite";
import { effrontCloudflare } from "@effront/cloudflare";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontCloudflare()],
});
```

Cloudflare Vite plugin はアダプターに含まれます。
そのオプションは `cloudflare` プロパティの下ではなく、`effrontCloudflare({ ...options })` に直接渡します。
Worker の設定を追加するには、[Wrangler の設定リファレンス](https://developers.cloudflare.com/workers/wrangler/configuration/)を参照してください。

## アプリケーションを起動して確認する {#local}

開発サーバーを起動します。

```bash
vp dev
```

表示された URL を開き、登録したルートにアクセスします。
「はじめる」のトップページなら、`Hello, Effront` が表示されます。

ビルド済み Worker を確認するには、開発サーバーを終了して次を実行します。

```bash
vp build
vp exec wrangler dev --local --config dist/rsc/wrangler.json
```

ビルド済み Worker とブラウザー用アセットを読み込むため、ソース用の `wrangler.jsonc` ではなく生成された設定を使ってください。
ビルドを移す際は、`dist/rsc/ssr` を含む成果物全体を保持します。
Wrangler の URL を開き、ページの表示、スタイル、クライアント側の操作を確認してください。
この構成でのローカル実行は、どちらもデプロイを行わず、Cloudflare の認証も不要です。

## アプリケーションの設定値を追加する {#context}

設定したアプリケーション名を表示するには、`wrangler.jsonc` に `vars` を追加します。

```json
{
  "vars": {
    "APP_LABEL": "My Effront App"
  }
}
```

`src/entry.effront.tsx` に次の import と取得関数の宣言を追加し、`HomePage` を置き換えます。
既存の `Effect` の import、`EFFRONT`、レイアウト、アプリケーションの export は残してください。

```tsx
import { createWorkersContextAccessors } from "@effront/cloudflare/workers";

const { getWorkersEnv } = createWorkersContextAccessors<{ APP_LABEL: string }>();

const HomePage = EFFRONT.Page.make({
  render: () =>
    Effect.gen(function* () {
      const env = yield* getWorkersEnv();
      return <h1>{env.APP_LABEL}</h1>;
    }),
});
```

Wrangler の設定変更後に開発サーバーを再起動し、`/` を開くと `My Effront App` が表示されます。
環境値は、Page やリクエスト用 Layer など、`createFetchHandler` が処理するリクエスト内で読み取ってください。
型引数は実行時の値を検証しないため、必須の値や形式は利用前に検証してください。
受信した `request`、`executionContext`、`waitUntil()` については、[Workers のコンテキスト取得関数](../api-reference/workers.md)を参照してください。

## 認証情報をサーバー側に留める {#secrets}

認証情報は、`vars` ではなく Cloudflare の secrets に保存してください。
ローカルの秘密値の設定は、[Cloudflare の環境変数ドキュメント](https://developers.cloudflare.com/workers/configuration/environment-variables/)に従ってください。
環境値を読み取るだけではブラウザーに送られませんが、JSX に描画したり Client Component の props に渡したりすると公開されます。
表示してよい値だけを返してください。

## Alchemy を使う構成を選ぶ {#alchemy}

Worker とリソースをコードで定義する場合は、この Wrangler 構成の代わりに [Alchemy のセットアップ](./alchemy.md)を使ってください。
