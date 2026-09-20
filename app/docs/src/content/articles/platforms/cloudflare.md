Effront のアプリケーションを Cloudflare Workers の実行環境で開発し、公開前に本番向けビルドをローカルで確認できるようにします。
以下では、既存のアプリケーションを Worker に接続し、Wrangler でアセットや環境値を設定します。
インフラをコードで定義したい場合は、[Alchemy を使う構成](#alchemy) を参照してください。

## アプリケーションを Worker に接続する {#setup}

[はじめる](../guide/getting-started.md) の手順で、`src/entry.effront.tsx` にアプリケーションを定義しておきます。
そのアプリケーションのディレクトリで、Workers アダプターと Wrangler をインストールします。
Cloudflare Vite plugin はアダプターに含まれます。

```bash
vp add -D @effront/cloudflare wrangler
```

この構成で使うファイルは次のとおりです。

```text
src/
  entry.workers.ts
  entry.effront.tsx
vite.config.ts
wrangler.jsonc
```

`src/entry.workers.ts` を作成し、次の Fetch エントリーを記述します。
`createFetchHandler` が Worker に届いたリクエストをアプリケーションにつなぐため、ページやルートの定義は `entry.effront.tsx` に置いたままにできます。

```typescript
import { createFetchHandler } from "@effront/core/workers";
import application from "./entry.effront";

export default { fetch: createFetchHandler(application) };
```

## Worker とビルドを設定する {#vite}

`wrangler.jsonc` を作成し、Worker 名と、先ほど追加した Fetch エントリーを指定します。
この構成では `nodejs_compat` を有効にしてください。
`assets` はブラウザー向けアセットの配信設定で、アセットのディレクトリはビルド時に生成される Wrangler 設定に含まれます。

```json
{
  "name": "my-effront-app",
  "main": "src/entry.workers.ts",
  "compatibility_date": "2026-09-12",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "binding": "ASSETS" }
}
```

続いて、`vite.config.ts` に Effront のビルド統合と Workers アダプターを登録します。
これにより、開発サーバーでもアプリケーションのサーバー側コードが Workers 環境で動きます。

```typescript
import { effront } from "@effront/vite";
import { effrontCloudflare } from "@effront/cloudflare";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontCloudflare()],
});
```

別の Wrangler 設定ファイルを使う場合など、Cloudflare plugin のオプションを変更するときは、`cloudflare` プロパティの下に入れず、`effrontCloudflare({ ...options })` に直接渡します。
Worker の設定を追加するときは、[Wrangler の設定リファレンス](https://developers.cloudflare.com/workers/wrangler/configuration/) を参照してください。

## アプリケーションを起動して確認する {#local}

アプリケーションのディレクトリで開発サーバーを起動します。

```bash
vp dev
```

ターミナルに表示された URL を開きます。
アプリケーションに登録したページが表示され、そのまま編集しながら開発できます。

開発サーバーでページが動いたら、ビルド済みアプリケーションも別に確認します。

```bash
vp build
vp exec wrangler dev --local --config dist/rsc/wrangler.json
```

この手順は Vite の開発サーバーを使わずにビルド済み Worker をローカルで実行するもので、デプロイは行いません。
ソース用の `wrangler.jsonc` ではなく、ビルド成果物とブラウザー向けアセットを参照する、生成済みの `dist/rsc/wrangler.json` を指定してください。
Worker の JavaScript ファイルだけを取り出さず、既定の `dist/rsc/ssr` ディレクトリを含めて、生成された成果物をまとめて保持します。

Wrangler のローカル URL を開き、ページの表示、スタイルの読み込み、クライアント側の操作が動くことを確認してください。
ここで示した最小構成なら、どちらのローカル実行にも Cloudflare の認証は不要です。

## アプリケーションの設定値を追加する {#context}

アプリケーションが動いたら、Worker の環境値を使って動作を変えられます。
たとえば、公開してよい表示名を設定するには、`wrangler.jsonc` に次の `vars` を追加します。

```json
{
  "vars": {
    "APP_LABEL": "My Effront App"
  }
}
```

`createWorkersContextAccessors<Env>()` を使うと、アプリケーションが想定する値を型付きで取得する関数を定義できます。
次の Effect は、設定した表示名と現在のリクエストのパスを組み合わせて返します。

```typescript
import { Effect } from "effect";
import { createWorkersContextAccessors } from "@effront/cloudflare/workers";

type Env = { APP_LABEL: string; SERVER_TOKEN?: string };
export const { getWorkersEnv, getWorkersRequestContext } = createWorkersContextAccessors<Env>();

const requestInfo = Effect.gen(function* () {
  const env = yield* getWorkersEnv();
  const context = yield* getWorkersRequestContext();
  return { label: env.APP_LABEL, path: new URL(context.request.url).pathname };
});
```

`requestInfo` は、Page やリクエスト用 Layer など、`createFetchHandler` が処理しているリクエスト内で実行してください。
`/about` へのリクエストなら、結果には設定した表示名とパス `/about` が含まれます。
型引数は想定する値を表すだけで実行時の検証は行わないため、必須の値や形式は、リクエスト用 Layer などで利用前に確認してください。

環境値だけを読む場合は `getWorkersEnv()` を使います。
受信した `request` や `executionContext` も必要なら、上の例のように `getWorkersRequestContext()` を使います。
取得関数の型と `executionContext.waitUntil()` の契約は、[Workers API リファレンス](../api-reference/workers.md) で説明しています。

## 認証情報をサーバー側に留める {#secrets}

表示名は `vars` に入れてページに表示できますが、`SERVER_TOKEN` のような認証情報は Cloudflare の secrets として設定してください。
環境変数やローカルの秘密値の設定は、[Cloudflare の環境変数ドキュメント](https://developers.cloudflare.com/workers/configuration/environment-variables/) に従ってください。

秘密値を読み取っただけで HTML や Flight に自動で含まれることはありません。
ただし、JSX に描画したり Client Component の props に渡したりすると、ブラウザーに公開されます。
秘密値はサーバー側のコードに留め、`requestInfo` の例のように、表示に使う値だけを返してください。

## Alchemy を使う構成を選ぶ {#alchemy}

上記の Wrangler 設定を管理する代わりに、Worker のインフラをコードで管理したい場合は、[Alchemy のセットアップ](./alchemy.md) を使ってください。
Effront アプリケーション向けの、別のホスト設定と開発手順を説明しています。
