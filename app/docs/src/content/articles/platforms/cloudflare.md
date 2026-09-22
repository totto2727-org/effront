[Cloudflare Workers サンプル](https://github.com/totto2727-org/effront/tree/main/examples/workers)を Vite でローカル実行し、ビルド済みの Worker を Wrangler で確認します。
このサンプルは `@effront/cloudflare` を使い、Alchemy は必要ありません。

## サンプルを起動する {#setup}

Node.js 24.11 以降と [Vite+](https://viteplus.dev/) をインストールし、次を実行します。

```bash
git clone https://github.com/totto2727-org/effront.git
cd effront
vp install
vp exec --filter "./packages/*" -- vp pack
cd examples/workers
vp dev
```

[http://127.0.0.1:1343](http://127.0.0.1:1343) を開きます。
トップページに `Hello, world!` と `Hello from Cloudflare Workers` が表示されます。
`Count: 0` をクリックしてカウンターが増えることを確認します。

## Worker の設定を確認する {#vite}

サンプルには Workers で動かすためのファイルが揃っています。

| ファイル                | 役割                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| `src/entry.effront.tsx` | ページ、ルートレイアウト、ルートを定義します。                                                     |
| `src/entry.workers.ts`  | `createFetchHandler(application)` で作成した Fetch ハンドラーをエクスポートします。                |
| `vite.config.ts`        | `effront()` と `effrontCloudflare()`、Tailwind を登録し、開発用とプレビュー用の URL を固定します。 |
| `wrangler.jsonc`        | Worker のエントリー、互換性設定、`ASSETS` バインディング、アプリケーション変数を定義します。       |
| `package.json`          | アダプター、Wrangler、アプリケーションの依存パッケージを定義します。                               |

ページの内容は `src/entry.effront.tsx` で変更します。
Wrangler の設定を変更するときは、既存の `nodejs_compat` フラグと `ASSETS` バインディングを保持してください。
その他のオプションは [Wrangler 設定リファレンス](https://developers.cloudflare.com/workers/wrangler/configuration/) を参照してください。

## ビルド済みの Worker をプレビューする {#local}

開発サーバーを停止し、`examples/workers` で次のコマンドを実行します。

```bash
vp build
vp preview
```

[http://127.0.0.1:4343](http://127.0.0.1:4343) を開き、カウンターと挨拶フォームを確認します。
Vite から独立してビルド済みの Worker を動かすには、プレビューを停止し、生成された Wrangler 設定を使います。

```bash
vp exec wrangler dev --local --config dist/rsc/wrangler.json --ip 127.0.0.1 --port 8787
```

[http://127.0.0.1:8787](http://127.0.0.1:8787) を開きます。
生成された設定は、`wrangler.jsonc` のソースエントリーではなく、ビルド済みの Worker とブラウザー用アセットを読み込みます。
これらのローカルコマンドはサンプルをデプロイせず、Cloudflare 認証も不要です。

## アプリケーション変数を変更する {#context}

`wrangler.jsonc` にある `APP_LABEL` の値を `My Effront App` に変更します。
`GREETING` とその他の設定はそのままにします。
`vp dev` を再起動し、[http://127.0.0.1:1343/about](http://127.0.0.1:1343/about) を開くと `My Effront App` が表示されます。

`src/features/greeting/services.ts` は `getWorkersEnv` で変数を読み取り、`Host` サービスとしてページに提供します。
`APP_LABEL` は About ページに、`GREETING` はトップページと挨拶の Server Function に使われます。
リクエストや `waitUntil()` へのアクセスは [Workers コンテキストアクセサー](../api-reference/workers.md) を参照してください。

<span id="secrets"></span>

表示用のテキストではなく認証情報を設定する場合は、`vars` の代わりに [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/environment-variables/) を使います。

## Alchemy でリソースを管理する {#alchemy}

Worker とリソースをコードで定義する場合は、別の [Alchemy サンプル](./alchemy.md)から始めてください。
