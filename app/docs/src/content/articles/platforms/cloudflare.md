まずは[最小構成の単独 Cloudflare サンプル](https://github.com/totto2727-org/effront/tree/main/examples/cloudflare)または `vp create effront -- my-app --platform cloudflare` から始められます。
このガイドでは一画面のサンプルを起動します。ナビゲーションやカウンター、リソースを使う Server Function は [Alchemy Basic](https://github.com/totto2727-org/effront/tree/main/examples/basic) を参照してください。

## サンプルを起動する {#setup}

Node.js 24.11 以降と [Vite+](https://viteplus.dev/) をインストールし、次を実行します。

```bash
vp create effront -- my-app --platform cloudflare
cd my-app
vp install
vp dev
```

Vite が表示するローカル URL を開きます。
一画面に `Hello, world` と表示されます。

## Worker の設定を確認する {#vite}

サンプルには Workers で動かすためのファイルが揃っています。

| ファイル                | 役割                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `src/entry.effront.tsx` | HTML レイアウト、一つのページ、`/` ルートを定義します。                             |
| `src/entry.workers.ts`  | `createFetchHandler(application)` で作成した Fetch ハンドラーをエクスポートします。 |
| `vite.config.ts`        | `effront()` と `effrontCloudflare()` を登録します。                                 |
| `wrangler.jsonc`        | Worker のエントリー、互換性の日付、`nodejs_compat` フラグを定義します。             |
| `package.json`          | アダプター、Wrangler、アプリケーションの依存パッケージを定義します。                |

ページの内容は `src/entry.effront.tsx` で変更します。
Wrangler の設定を変更するときは `nodejs_compat` フラグを保持してください。最小構成にはアプリケーション変数や `ASSETS` バインディングはありません。
`APP_LABEL` のようなバインディングを追加する場合は `wrangler.jsonc` に `vars: { APP_LABEL: "Greeting Worker" }` を定義し、リクエスト中の Effect から `getWorkersEnv<{ APP_LABEL: string }>()` で読みます。`src/entry.workers.ts` の Fetch エントリーがアプリケーションを `createFetchHandler` に渡し、リクエストコンテキストを提供します。
その他のオプションは [Wrangler 設定リファレンス](https://developers.cloudflare.com/workers/wrangler/configuration/) を参照してください。

## ビルド済みの Worker を Wrangler で実行する {#local}

開発サーバーを停止し、生成したプロジェクトで次のコマンドを実行します。

```bash
vp build
vp exec wrangler dev --local --config dist/rsc/wrangler.json --ip 127.0.0.1 --port 8787
```

[http://127.0.0.1:8787](http://127.0.0.1:8787) を開きます。
生成された設定は、`wrangler.jsonc` のソースエントリーではなく、ビルド済みの Worker とブラウザー用アセットを読み込みます。
これらのローカルコマンドはサンプルをデプロイせず、Cloudflare 認証も不要です。

## Worker のバインディングとリクエスト情報を読む {#context}

`createFetchHandler` が処理する Page、Server Function、アプリケーション Layer など、リクエスト内で実行される Effect からアクセサーを使います。
`API_ORIGIN` 変数を持つ Worker では、次のヘルパーでバインディングとリクエスト URL を読み、監査処理を `waitUntil()` に渡せます。

```typescript
import { getWorkersEnv, getWorkersRequestContext } from "@effront/cloudflare/workers";
import { Effect } from "effect";

type Env = { API_ORIGIN: string };

export const readRequestSettings = Effect.fn("app/readRequestSettings")(function* (
  recordAccess: (path: string) => Promise<void>,
) {
  const env = yield* getWorkersEnv<Env>();
  const { request, executionContext } = yield* getWorkersRequestContext<Env>();
  const path = new URL(request.url).pathname;
  executionContext.waitUntil(recordAccess(path));
  return { apiOrigin: env.API_ORIGIN, path };
});
```

`API_ORIGIN` を Worker に設定し、このヘルパーを Effect 内から呼ぶ際に、自分の `recordAccess` 関数を渡します。

> [!WARNING]
> 型引数はホストの値を記述するもので、実行時には検証しません。
> 秘密のバインディングをブラウザーへ表示・返却しないでください。

ファクトリーで `Env` を一度指定すると、アクセサーを呼ぶ際の型引数が不要になります。

```typescript
import { createWorkersContextAccessors } from "@effront/cloudflare/workers";
import { Effect } from "effect";

type Env = { API_ORIGIN: string };
const workers = createWorkersContextAccessors<Env>();

export const currentRequest = Effect.gen(function* () {
  const env = yield* workers.getWorkersEnv();
  const { request } = yield* workers.getWorkersRequestContext();
  return { apiOrigin: env.API_ORIGIN, path: new URL(request.url).pathname };
});
```

詳しい契約は [Workers コンテキストのリファレンス](../api-reference/workers.md#cloudflare)を参照してください。

<span id="secrets"></span>

表示用のテキストではなく認証情報を設定する場合は、`vars` の代わりに [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/environment-variables/) を使います。

## Alchemy でリソースを管理する {#alchemy}

Worker とリソースをコードで定義する場合は、別の [Alchemy サンプル](./alchemy.md)から始めてください。
