## Native HTTP への接続 {#http}

`@effront/alchemy/cloudflare` は `ApplicationLoader`、`applicationHttpEffect`、`makeApplicationHttpEffect` を公開します。
`ApplicationLoader` はアプリケーション定義を遅延取得する関数です。
RSC アプリケーションをインフラ構築時に import しないために使います。

`applicationHttpEffect(loader)` は現在のリクエストから native HTTP response を生成します。
`makeApplicationHttpEffect(loader)` は構築時の外部 capability references を捕捉した再利用可能な HTTP Effect を返します。
どちらも typed application failures を HTTP 境界で扱えます。
アプリケーション Layer の取得はリクエスト単位のままです。
構築時の request、Scope、router をリクエストへ復元するものではありません。

サービス参照の捕捉はシリアライズでも RPC でもなく、寿命を延長しません。
能力の所有者は全レスポンスの終了まで生存させる必要があります。
[完全な Worker と stack](../platforms/alchemy.md) を先に用意してください。

## effrontAlchemy {#vite}

`@effront/alchemy/cloudflare/vite` の `effrontAlchemy({ worker? })` は native Worker bridge と runtime compile 設定を追加します。
既定 Worker は `./src/entry.workers.ts` です。
共通の `effront()` の後に別々に登録します。
`application` は `effront()` に指定し、こちらへ渡しません。

Alchemy CLI が実際の host plugin と binding を注入します。
手動 host 登録や Wrangler 設定はアプリケーションの責務ではありません。
Alchemy beta.77 の official CLI の profile 前提と、認証なしのローカル test host は別の検証境界です。
