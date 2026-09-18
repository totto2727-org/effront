## serve {#serve}

`@effront/server/node` と `@effront/server/bun` は `serve(handler, options)` を公開します。
native Effect HTTP handler を受け取り、scoped な Layer を返します。
`Layer.launch` と対象プラットフォームの Runtime を使って起動します。
完成した entry は [Node.js / Bun の手順](../platforms/node-bun.md) を参照してください。

| オプション | 契約                                                    |
| ---------- | ------------------------------------------------------- |
| `assets`   | 必須。client mount と optional public root を指定します |
| `port`     | 既定値 `3000`                                           |
| `hostname` | 既定値 `127.0.0.1`。外部へ公開する場合は明示します      |

## withAssets {#assets}

`@effront/server/assets` の `withAssets(handler, options)` は、呼び出し元の FileSystem と Path services を使う native HTTP handler を構成します。
client の root は専用の配信ディレクトリ、prefix は root 以外の絶対 URL prefix です。
public root は任意で、完全一致のファイルだけを配信します。
起動時の directory 検証ではなく、リクエスト到着時にファイルを検索します。

MIME、弱い ETag、conditional response、HEAD、単一 byte range は Effect `4.0.0-rc.112` の `HttpStaticServer` に従います。
HEAD と 304 はファイルストリームを取得しません。
複数 range・非対応 range・安全整数の範囲外の range は無視されます。
有効でも満たせない単一 range は 416 です。
この Effect 版は `If-Range` を無視し、HEAD でも Range を評価します。
416 には `Content-Range` が付きますが asset cache / validator headers は付きません。
独自の HttpPlatform / ETag service を渡して asset 応答を変更する契約ではありません。

配信ディレクトリと symlink の管理は利用者の責任です。
client prefix 内の miss は 404 でアプリルートへ入りません。
public files に directory index や SPA fallback はありません。

## effrontServer {#vite}

`@effront/server/vite` の `effrontServer({ rsc?, server? })` を `effront()` の後に登録します。
既定値は `src/entry.rsc.ts` と `src/entry.server.ts`、前者は名前付き `handler` Effect を公開します。
Vite dev / preview は Node 互換ミドルウェアで別 listener を起動しません。
Bun 固有の動作は `bun dist/rsc/server.js` で検証します。
tooling には `@effect/platform-node` が必要です。
