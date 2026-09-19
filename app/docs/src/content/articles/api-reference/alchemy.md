## Native HTTP への接続 {#http}

`@effront/alchemy/cloudflare` は `ApplicationLoader`、`applicationHttpEffect`、`makeApplicationHttpEffect` を公開します。
`ApplicationLoader` はリクエスト処理時にアプリケーション定義を取得する関数です。
アプリケーション定義はこの関数の中で動的 import してください。

`applicationHttpEffect(loader, options?)` は現在のリクエストから native HTTP response を生成します。
`options.context` には外部サービスの Context を渡せます。
同じサービスが現在のリクエストにもある場合は、リクエスト側の値が優先されます。
`makeApplicationHttpEffect(loader)` は構築時の外部 capability references を捕捉した再利用可能な HTTP Effect を返します。
どちらも typed application failures を HTTP 境界で扱えます。
アプリケーション Layer の取得はリクエスト単位のままです。
構築時の Scope や HTTP リクエストのサービスは持ち越しません。

サービス参照を捕捉しても、サービスの取得や寿命の延長は行いません。
能力の所有者は全レスポンスの終了まで生存させる必要があります。
[完全な Worker と stack](../platforms/alchemy.md) を先に用意してください。

## effrontAlchemy {#vite}

`@effront/alchemy/cloudflare/vite` の `effrontAlchemy({ worker? })` は Alchemy Worker の開発・ビルドに使います。
既定 Worker は `./src/entry.workers.ts` です。
`worker` は Vite root を基準に解決され、Alchemy Worker を default export するモジュールを指定します。
共通の `effront()` の後に別々に登録します。
`application` は `effront()` に指定し、こちらへ渡しません。

開発には Alchemy CLI を使います。
別の host plugin や Wrangler 設定を追加する必要はありません。
Alchemy beta.77 の CLI はローカル開発でも設定済みの Cloudflare profile を必要とします。
