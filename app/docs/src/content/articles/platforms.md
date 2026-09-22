Effront はアダプターを使って、さまざまなホストでアプリケーションを動かします。
以下からプラットフォームを選び、既存のサンプルを起動して、開発環境と本番環境を設定するファイルを確認してください。

## ホスティング方式を選ぶ {#support}

<span id="setup"></span><span id="entries"></span><span id="assets"></span>

| 用途                                                      | パッケージ            | サンプルのガイド                                |
| --------------------------------------------------------- | --------------------- | ----------------------------------------------- |
| Wrangler で Cloudflare Worker を管理する                  | `@effront/cloudflare` | [Cloudflare Workers](./platforms/cloudflare.md) |
| Alchemy で Worker とリソースを管理する                    | `@effront/alchemy`    | [Alchemy](./platforms/alchemy.md)               |
| <span id="node">Node.js</span> の HTTP サーバーを起動する | `@effront/server`     | [Node.js](./platforms/node.md)                  |
| <span id="bun">Bun</span> の HTTP サーバーを起動する      | `@effront/server`     | [Bun](./platforms/bun.md)                       |
