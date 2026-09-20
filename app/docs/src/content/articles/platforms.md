Effront は、アダプターを使ってさまざまな環境にデプロイできます。
デプロイ先に合わせて、開発環境と本番環境をセットアップします。

## ホスティング方法を選ぶ {#support}

| 目的                                               | パッケージ            | セットアップ                                    |
| -------------------------------------------------- | --------------------- | ----------------------------------------------- |
| Wrangler で Cloudflare Worker を管理する           | `@effront/cloudflare` | [Cloudflare Workers](./platforms/cloudflare.md) |
| Alchemy で Cloudflare Workers とリソースを管理する | `@effront/alchemy`    | [Alchemy](./platforms/alchemy.md)               |
| Node.js または Bun の HTTP サーバーを起動する      | `@effront/server`     | [Node.js / Bun](./platforms/node-bun.md)        |
